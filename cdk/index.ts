import { App, Tags } from 'aws-cdk-lib';
import { RunnerStack } from './RunnerStack';
import { BuildConfig } from './BuildConfig';

const app = new App();

// Some helper functions for type enforcement
function verifyString(object: { [name: string]: any }, propName: string): string {
  if (!object[propName] || object[propName].trim().length === 0)
    throw new Error(propName + ' does not exist or is empty.');

  return object[propName];
}

function verifyArray(object: { [name: string]: any }, propName: string): string[] {
  if (!object[propName] || object[propName].length === 0) throw new Error(propName + ' does not exist or is empty.');

  return object[propName];
}

function verifyBool(object: { [name: string]: boolean }, propName: string): boolean {
  if (typeof object[propName] != 'boolean') throw new Error(propName + ' does not exist or is empty.');

  return object[propName];
}

function verifyNumber(object: { [name: string]: number }, propName: string): number {
  if (typeof object[propName] != 'number') throw new Error(propName + ' does not exist or is empty.');

  return object[propName];
}

// Load config function
function loadConfig() {
  let env = app.node.tryGetContext('config');
  if (!env) throw new Error('Context variable missing on CDK command. Pass in as `-c config=<env>`');

  let unparsedEnv = app.node.tryGetContext(env);

  let buildConfig: BuildConfig = {
    App: verifyString(unparsedEnv, 'App'),
    AWSAccountID: verifyString(unparsedEnv, 'AWSAccountID'),
    AWSRegion: verifyString(unparsedEnv, 'AWSRegion'),
    Environment: verifyString(unparsedEnv, 'Environment'),
    Team: verifyString(unparsedEnv, 'Team'),
    Version: verifyString(unparsedEnv, 'Version'),

    Parameters: {
      availabilityZones: verifyArray(unparsedEnv['BuildParameters'], 'availabilityZones'),
      baseImageAccessAccounts: verifyArray(unparsedEnv['BuildParameters'], 'baseImageAccessAccounts'),
      buildEnvironment: verifyString(unparsedEnv['BuildParameters'], 'buildEnvironment'),
      containerBuildPath: verifyString(unparsedEnv['BuildParameters'], 'containerBuildPath'),
      ecrRepoName: verifyString(unparsedEnv['BuildParameters'], 'ecrRepoName'),
      ecrSourceAccount: verifyString(unparsedEnv['BuildParameters'], 'ecrSourceAccount'),
      maxCpu: verifyNumber(unparsedEnv['BuildParameters'], 'maxCpu'),
      maxMem: verifyNumber(unparsedEnv['BuildParameters'], 'maxMem'),
      organizationUrl: verifyString(unparsedEnv['BuildParameters'], 'organizationUrl'),
      privateSubnetIds: verifyArray(unparsedEnv['BuildParameters'], 'privateSubnetIds'),
      runnerGroup: verifyString(unparsedEnv['BuildParameters'], 'runnerGroup'),
      skipContainerBuild: verifyBool(unparsedEnv['BuildParameters'], 'skipContainerBuild'),
      taskCount: verifyNumber(unparsedEnv['BuildParameters'], 'taskCount'),
      taskCpu: verifyString(unparsedEnv['BuildParameters'], 'taskCpu'),
      taskMax: verifyNumber(unparsedEnv['BuildParameters'], 'taskMax'),
      taskMem: verifyString(unparsedEnv['BuildParameters'], 'taskMem'),
      taskMin: verifyNumber(unparsedEnv['BuildParameters'], 'taskMin'),
      vpcId: verifyString(unparsedEnv['BuildParameters'], 'vpcId'),
    },
  };

  return buildConfig;
}

// Main stack build function
async function Main(): Promise<RunnerStack> {
  let buildConfig: BuildConfig = loadConfig();

  Tags.of(app).add('Service', buildConfig.App);
  Tags.of(app).add('Environment', buildConfig.Environment);
  Tags.of(app).add('Team', buildConfig.Team);

  let runnerStackName = buildConfig.App + buildConfig.Environment;
  const runnerStack = new RunnerStack(
    app,
    runnerStackName,
    {
      env: {
        region: buildConfig.AWSRegion,
        account: buildConfig.AWSAccountID,
      },
    },
    buildConfig
  );

  return runnerStack;
}
Main();
