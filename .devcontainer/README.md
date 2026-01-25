# DevContainer Setup for MovieNight

This directory contains the development container configuration for the MovieNight React application.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- [Visual Studio Code](https://code.visualstudio.com/)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) for VS Code

## Getting Started

1. Open this project in Visual Studio Code
2. When prompted, click "Reopen in Container" (or use Command Palette: `Dev Containers: Reopen in Container`)
3. VS Code will build the Docker container and set up the development environment
4. Once the container is ready, dependencies will be automatically installed via `npm install`
5. You can start the development server by running `npm start` in the terminal

## What's Included

### Base Environment
- Node.js 20 (LTS)
- Git
- GitHub CLI

### VS Code Extensions
- ESLint
- Prettier
- ES7+ React/Redux/React-Native snippets
- Babel JavaScript
- TypeScript
- Tailwind CSS IntelliSense

### Port Forwarding
- Port 3000 is automatically forwarded for the React development server

## Running the Application

After the container starts, open a terminal in VS Code and run:

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run deploy` - Deploys to GitHub Pages

## Firebase Configuration

The Firebase configuration is already set up in [src/db/firebase.js](../src/db/firebase.js). If you need to use a different Firebase project, update the configuration there.

## Troubleshooting

### Container won't build
- Ensure Docker Desktop is running
- Try rebuilding the container: Command Palette > `Dev Containers: Rebuild Container`

### Port 3000 already in use
- Stop any other processes using port 3000
- Or change the port in [package.json](../package.json) scripts

### Permission issues
- The container runs as the `node` user (non-root) for security
- If you encounter permission issues, they may need to be addressed in the Dockerfile

## Customization

You can customize the devcontainer by editing:
- [devcontainer.json](devcontainer.json) - VS Code settings, extensions, and features
- [Dockerfile](Dockerfile) - Base image and system dependencies
