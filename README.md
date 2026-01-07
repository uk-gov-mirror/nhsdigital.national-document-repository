# national-document-repository

## Links

- [Lambda function README.md](lambdas/README.md).
- [React User Interface README.md](app/README.md).
- [E2E test README.md](lambdas/tests/e2e/README.md) (we have E2E tests for our FHIR endpoints and APIM setup).

## Running Locally

The dev container option standardises tools for both python (via poetry) and node via asdf.

> [!WARNING]
> Once you have the dev container running, you will need to install your git credentials for signing your commits.

<!-- -->
> If the dev container build errors on docker, check your config at `~/.docker/config.json`, which should have something similar to:
>
> ```json
> {
>     "auths": {}
> }
> ```
>
> Remove any lines that mention `desktop`.

### Pre-requisites

The following tools are required for all options:

- [Git](https://git-scm.com/)
- Docker (e.g. via [Brew](https://formulae.brew.sh/formula/docker))

Setup an environment variable on your local system. The environment variable points to your national-document-repository-infrastructure directory on your local system.
For Linux/MacOS users add the following to your ~/.zshrc or ~/.bashrc file

```bash
export NDRI_LOCATION=<national-document-repository-infrastructure FOLDER location>
```

For Windows users, please follow Microsoft's recommendations for creating persistent environment variables

### Method 1 - Dev container within VS Code (recommended)

> [!IMPORTANT]
> This **will not work** within a VS Code Workspace.

1. Install the `Dev Containers` VSCode extension.
1. Press `Ctrl+Shift+P`.
1. Select `Dev Containers: Rebuild and Reopen in Container`.

### Method 2 - Dev container (not using VS Code)

If you don't use VSCode, run the following commands:

```bash
npm install -g @devcontainers/cli
devcontainer build --workspace-folder .
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
devcontainer exec --workspace-folder . nvim .
```

Inside the container you can run the following.

```bash
nvim
tmux
lazygit
```

### Method 3 - Manual installation

- [Terraform](https://formulae.brew.sh/formula/terraform)
- [docker-compose](https://formulae.brew.sh/formula/docker-compose)
- [AWS CLI](https://aws.amazon.com/cli/)
- [Awsume](https://formulae.brew.sh/formula/awsume)
- [ruff](https://formulae.brew.sh/formula/ruff)
- [Node@24](https://formulae.brew.sh/formula/node@24)
- [Python@3.11](https://formulae.brew.sh/formula/python@3.11)

### Initial Setup of the container

1. Configure Github-CLI with

```bash
gh auth login
```

## Deploying a sandbox

In order to fully test your development it may be necessary to build and deploy your own temporary sandbox on the dev environment. In order to build a sandbox please [follow the steps outlined in confluence](https://nhsd-confluence.digital.nhs.uk/spaces/NDR/pages/1145307545/How+To+Deploy+Custom+Sandbox)

## Monitoring

We have configured AWS CloudWatch to provide alarm notifications whenever one of a number of metrics exceeds its normal
state. Currently, the only way to receive these notifications is by subscribing to an SNS topic using an email. You can
subscribe to the SNS topic once you have assumed an appropriate role using the AWS CLI. This is the command:

```bash
aws sns subscribe --topic-arn [topic-arn] --protocol email --notification-endpoint [your NHS email]
```

You will receive a confirmation email with a link allowing you to confirm the subscription. We are also subscribing to
the SNS topic using email addresses that are provided for Microsoft Teams channels.
