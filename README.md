# VisionsTrust Open Repository

Open source project of VisionsTrust Data Intermediary APIs

## Planned additions

The open sourcing of VisionsTrust is a work in progress, thus the different APIs are not documented outside of the code yet (such as swagger / postman), but will be in a near future.

We are planning to separate different bricks of the code into separate packages. These apply to the logics concerning consents and contracts for them to be reusable without the complete VisionsTrust infrastructure.

## Installation and getting started

After cloning the repo, you will need to configure your .npmrc with a Github PAT (Personal access token) with read access to packages in order to install @visionsofficial packages. Copy the .npmrc.sample file and rename it to .npmrc and set your token as you wish. We recommend setting it as an NPM_TOKEN variable but the choice is yours.

We use pnpm for managing packages.

If you don't have pnpm installed you simply need to run
```bash
npm i -g pnpm
```

After cloning the repo, run 
```bash
pnpm i
```
to install packages.

### Environment variables

Copy the .env.sample and rename it to .env, then set your environment variables for your local environment.

## Troubleshoot

### Why can't I install @visionsofficial packages ?

To install packages from the github registry, you need a github PAT (personnal access token) with a read access right scope on it. By authenticating with your token, you are then able to install github packages. Please follow the github packages documentation for more info.