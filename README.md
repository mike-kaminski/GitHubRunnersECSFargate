# GitHub Private Runner Service

-----------
GitHub allows developers to run GitHub Actions workflows on your own runners.
This Docker image allows you to create your own runners on Docker.

## Important notes

* GitHub [recommends](https://help.github.com/en/github/automating-your-workflow-with-github-actions/about-self-hosted-runners#self-hosted-runner-security-with-public-repositories) that you do **NOT** use self-hosted runners with public repositories, for security reasons.
* Organization level self-hosted runners are supported (see environment variables).

## Usage

### Basic usage
To add another environment (possibly with a custom container), modify the `cdk/cdk.json` file to include a new context and parameters relevent to your new environment, for example the "ops-dev" context will deploy to the dev account using a container built from the docker folder with access to that image from the ops-preprod and ops-prod accounts:

```
    "ops-dev": {
      "App": "GitHubRunners",
      "AWSAccountID": "123456789100",
      "AWSRegion": "us-east-1",
      "Environment": "WebOpsDev",
      "Version": "v0.0.1-alpha",
      "Team": "WebPlatform",

      "BuildParameters": {
        "baseImageAccessAccounts": ["123456789101", "123456789102"],
        "containerBuildPath": "../docker",
        "ecrSourceAccount": "123456789100",
        "ecrRepoName": "github-runner",
        "maxCpu": "80",
        "maxMem": "80",
        "organizationUrl": "https://github.com/OrganizationName",
        "privateSubnetIds": ["subnet-05a1dbbbcdff2e821", "subnet-053390f86ac53b222"],
        "runnerGroup": "web-ops-dev",
        "skipContainerBuild": "true",
        "taskCount": "2",
        "taskCpu": "4096",
        "taskMax": "4",
        "taskMem": "8192",
        "taskMin": "1",
        "vpcId": "vpc-054f9a652a3522f00"
      }
    }
```

In the `cdk/package.json` file, include a new set of CDK commands in the scripts section for your new environment:

```
...
    "cdk-diff-ops-dev": "npx cdk diff \"*\" -c config=ops-dev",
    "cdk-deploy-ops-dev": "npx cdk deploy \"*\" -c config=ops-dev",
    "cdk-destroy-ops-dev": "npx cdk destroy \"*\" -c config=ops-dev"
...
```

## Environment variables

The following environment variables allows you to control the configuration parameters.

| Name | Description | Required/Default value |
|------|---------------|-------------|
| RUNNER_REPOSITORY_URL | The runner will be linked to this repository URL. | Required if `RUNNER_ORGANIZATION_URL` is not provided |
| RUNNER_ORGANIZATION_URL | The runner will be linked to this organization URL. | Required if `RUNNER_REPOSITORY_URL` is not provided |
| GITHUB_ACCESS_TOKEN | Personal Access Token. Used to dynamically fetch a new runner token (recommended, see below). | Required if `RUNNER_TOKEN` is not provided.
| RUNNER_TOKEN | Runner token provided by GitHub in the Actions page. These tokens are valid for a short period. | Required if `GITHUB_ACCESS_TOKEN` is not provided
| RUNNER_WORK_DIRECTORY | Runner's work directory | `"_work"`
| RUNNER_NAME | Name of the runner displayed in the GitHub UI | Hostname of the container
| RUNNER_LABELS | Extra labels in addition to the default: 'self-hosted,Linux,X64' (based on your OS and architecture) | `""`
| RUNNER_REPLACE_EXISTING | `"true"` will replace existing runner with the same name, `"false"` will use a random name if there is conflict | `"true"`

Currently the module is configured to only use the RUNNER_LABELS, RUNNER_ORGANIZATION_URL, and GITHUB_ACCESS_TOKEN variables which provides us organization level runners (accessible by any repository in the GitHub organization). Future efforts may serve to make this more flexible using toggles for assigning an organization level or repository level runner.

## Runner Token

In order to link your runner to your repository/organization, you need to provide a token. There are two ways to pass the token :

* via `GITHUB_ACCESS_TOKEN` (recommended), containing a [Personal Access Token](https://github.com/settings/tokens). This token will be used to dynamically fetch a new runner token, as runner tokens are valid for a short period of time.
  * For a single-repository runner, your PAT should have `repo` scopes.
  * For an organization runner, your PAT should have `admin:org//manage_runners:org` scopes.
* via `RUNNER_TOKEN`. This token is displayed in the Actions settings page of your organization/repository, when opening the "Add Runner" page.

## Runner auto-update behavior

The GitHub runner (the binary) will update itself when receiving a job, if a new release is available.
In order to allow the runner to exit and restart by itself, the binary is started by a supervisord process.
