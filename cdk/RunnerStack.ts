import ecs = require('aws-cdk-lib/aws-ecs');
import path = require('path');
import { App, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { AccountPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { BuildConfig } from './BuildConfig';
import * as ecrdeploy from 'cdk-ecr-deployment';

let ecrRepo: Repository;
export class RunnerStack extends Stack {
  constructor(app: App, id: string, stackProps: StackProps, buildConfig: BuildConfig) {
    super(app, id, stackProps);

    /* Build and upload Docker container image only in specific environments for immutable deployments.
       Add your build environment to the buildEnvironment parameter in cdk.json.
    */
    const buildEnv = [buildConfig.Parameters.buildEnvironment];
    if (~buildEnv.indexOf(buildConfig.Environment)) {
      ecrRepo = new Repository(this, `${buildConfig.App}${buildConfig.Environment}Repository`, {
        repositoryName: buildConfig.Parameters.ecrRepoName,
        removalPolicy: RemovalPolicy.DESTROY,
      });
      ecrRepo.grantPullPush(new AccountPrincipal(buildConfig.AWSAccountID));
      ecrRepo.addLifecycleRule({ maxImageCount: 10 });

      // Grant pull permissions to the base ECR repository for any other accounts that will use the image.
      const accounts = buildConfig.Parameters.baseImageAccessAccounts;
      for (const account of Object.values(accounts)) {
        ecrRepo.grantPull(new AccountPrincipal(account));
      }
    }

    // We don't always want to build and publish the container. Set the skipContainerBuild param to true in this circumstance.
    if (!buildConfig.Parameters.skipContainerBuild) {
      const image = new DockerImageAsset(this, `${buildConfig.App}${buildConfig.Environment}DockerImage`, {
        buildArgs: {
          BUILD_DATE: Date().toLocaleString(),
        },
        directory: path.join(__dirname, buildConfig.Parameters.containerBuildPath),
        platform: Platform.LINUX_AMD64,
      });

      new ecrdeploy.ECRDeployment(this, `${buildConfig.App}${buildConfig.Environment}DeployDockerImage`, {
        src: new ecrdeploy.DockerImageName(image.imageUri),
        dest: new ecrdeploy.DockerImageName(`${ecrRepo.repositoryUri}:${buildConfig.Version}`),
      });
    }

    // Look up VPC from VPC ID and select subnets.
    // availabilityZones must consist of the AZ's the selected subnets are members of.
    const vpcId = buildConfig.Parameters.vpcId;
    const vpc = Vpc.fromVpcAttributes(this, `${buildConfig.App}${buildConfig.Environment}Vpc`, {
      vpcId: vpcId,
      availabilityZones: buildConfig.Parameters.availabilityZones,
      privateSubnetIds: buildConfig.Parameters.privateSubnetIds,
    });

    // Assign the log group.
    const logGroup = new LogGroup(this, `${buildConfig.App}${buildConfig.Environment}Logs`, {
      logGroupName: `${buildConfig.App}${buildConfig.Environment}`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Set the security group to allow all outbound traffic.
    const securityGroup = new SecurityGroup(this, `${buildConfig.App}${buildConfig.Environment}SecurityGroup`, {
      vpc,
      allowAllOutbound: true,
      securityGroupName: `${buildConfig.App}${buildConfig.Environment}SecurityGroup`,
    });

    // Create a secret for the GitHub PAT
    const gitHubSecret = new Secret(this, `${buildConfig.App}${buildConfig.Environment}GitHubSecret`, {
      secretName: `${buildConfig.App}${buildConfig.Environment}GitHubSecret`,
    });

    // Create a basic Fargate service without a load balancer.
    const fargateService = new ecs.FargateService(this, `${buildConfig.App}${buildConfig.Environment}Fargate`, {
      serviceName: `${buildConfig.App}${buildConfig.Environment}`,
      cluster: new ecs.Cluster(this, `${buildConfig.App}${buildConfig.Environment}Cluster`, {
        clusterName: `${buildConfig.App}-${buildConfig.Environment}Cluster`,
        containerInsights: true,
        enableFargateCapacityProviders: true,
        vpc,
      }),
      circuitBreaker: { rollback: true },
      desiredCount: buildConfig.Parameters.taskCount,
      enableExecuteCommand: true,
      taskDefinition: new ecs.TaskDefinition(this, `${buildConfig.App}${buildConfig.Environment}TaskDefinition`, {
        cpu: buildConfig.Parameters.taskCpu,
        memoryMiB: buildConfig.Parameters.taskMem,
        family: `${buildConfig.App}-${buildConfig.Environment}`,
        compatibility: ecs.Compatibility.FARGATE,
        runtimePlatform: {
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
        },
        networkMode: ecs.NetworkMode.AWS_VPC,
      }),
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
    });

    // Configure and assign the container to the task definition.
    fargateService.taskDefinition.addContainer(`${buildConfig.App}${buildConfig.Environment}Container`, {
      containerName: `${buildConfig.App}${buildConfig.Environment}`,
      logging: ecs.LogDriver.awsLogs({
        logGroup: logGroup,
        streamPrefix: `${buildConfig.App}${buildConfig.Environment}`,
      }),
      portMappings: [],
      image: ecs.EcrImage.fromRegistry(
        `${buildConfig.Parameters.ecrSourceAccount}.dkr.ecr.us-east-1.amazonaws.com/${buildConfig.Parameters.ecrRepoName}:${buildConfig.Version}`
      ),
      environment: {
        ENVIRONMENT: buildConfig.Environment,
        RUNNER_LABELS: `${buildConfig.App}${buildConfig.Environment}`,
        RUNNER_ORGANIZATION_URL: buildConfig.Parameters.organizationUrl,
      },
      secrets: {
        GITHUB_ACCESS_TOKEN: ecs.Secret.fromSecretsManager(gitHubSecret),
      },
    });

    // Set base requirements for execution role. These are typically static.
    fargateService.taskDefinition.addToExecutionRolePolicy(
      new PolicyStatement({
        sid: 'ExecutionRoleBase',
        effect: Effect.ALLOW,
        actions: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'kms:Decrypt',
          'kms:DescribeKey',
          'logs:CreateLogGroup',
        ],
        resources: ['*'],
      })
    );

    // Set base requirements for task role. These are typically static.
    fargateService.taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        sid: 'TaskRoleBase',
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'ssm:GetParameters',
          'secretsmanager:GetSecretValue',
          'kms:Decrypt',
          'kms:DescribeKey',
        ],
        resources: ['*'],
      })
    );

    // Customize the task role for workload requirements.
    fargateService.taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        sid: 'TaskRoleCustomization',
        effect: Effect.ALLOW,
        actions: ['sts:GetFederationToken', 'sts:AssumeRole', 'iam:PassRole'],
        resources: ['*'],
      })
    );

    // Set autoscaling policy
    const scalableTarget = fargateService.autoScaleTaskCount({
      minCapacity: buildConfig.Parameters.taskMin,
      maxCapacity: buildConfig.Parameters.taskMax,
    });

    // Scale based on CPU
    scalableTarget.scaleOnCpuUtilization(`${buildConfig.App}${buildConfig.Environment}CpuScale`, {
      targetUtilizationPercent: buildConfig.Parameters.maxCpu,
    });

    // Scale based on RAM
    scalableTarget.scaleOnMemoryUtilization(`${buildConfig.App}${buildConfig.Environment}MemScale`, {
      targetUtilizationPercent: buildConfig.Parameters.maxMem,
    });
  }
}

export default RunnerStack;
