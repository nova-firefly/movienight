# Use official Node.js LTS image as base
FROM node:20-bullseye

# Install additional tools and dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    git \
    ca-certificates \
    curl \
    gnupg \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Configure npm to not show funding messages and update notifications
RUN npm config set fund false && npm config set update-notifier false

# Install global npm packages that might be useful
RUN npm install -g npm@latest

# The node user is already created in the base image with UID 1000
# Ensure proper permissions for the workspace
RUN chown -R node:node /workspace

# Switch to non-root user
USER node

# Expose port 3000 for React development server
EXPOSE 3000

# Default command (can be overridden)
CMD ["bash"]
