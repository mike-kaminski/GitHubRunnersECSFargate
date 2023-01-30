export interface BuildConfig {
  readonly App: string;
  readonly AWSAccountID: string;
  readonly AWSRegion: string;
  readonly Environment: string;
  readonly Team: string;
  readonly Version: string;

  readonly Parameters: BuildParameters;
}

export interface BuildParameters {
  readonly availabilityZones: string[];
  readonly baseImageAccessAccounts: string[];
  readonly buildEnvironment: string;
  readonly containerBuildPath: string;
  readonly ecrRepoName: string;
  readonly ecrSourceAccount: string;
  readonly maxCpu: number;
  readonly maxMem: number;
  readonly organizationUrl: string;
  readonly privateSubnetIds: string[];
  readonly runnerGroup: string;
  readonly skipContainerBuild: boolean;
  readonly taskCount: number;
  readonly taskCpu: string;
  readonly taskMax: number;
  readonly taskMem: string;
  readonly taskMin: number;
  readonly vpcId: string;
}
