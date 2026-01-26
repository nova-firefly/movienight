# Multi-stage build for MovieNight React application
# Stage 1: Build the React application
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (clean install for reproducibility)
RUN npm ci --only=production --ignore-scripts

# Copy application source
COPY . .

# Build the application (creates /app/build directory)
RUN npm run build

# Stage 2: Production image with nginx
FROM nginx:alpine

# Copy built application from build stage
# The build output goes to /movienight because of homepage in package.json
COPY --from=build /app/build /usr/share/nginx/html/movienight

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check to verify container is serving content
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/movienight/ || exit 1

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
