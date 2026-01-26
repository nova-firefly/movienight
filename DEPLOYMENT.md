# MovieNight Deployment Guide

This document describes how to deploy the MovieNight React application to a remote Docker host using GitHub Actions.

## Architecture

- **Application:** React 18 + TypeScript (Create React App)
- **Build Tool:** npm (Node.js 20)
- **Web Server:** nginx:alpine
- **Container Registry:** GitHub Container Registry (GHCR)
- **Deployment Method:** SSH-based deployment via GitHub Actions
- **Target:** Remote Docker host (separate PC)

## CI/CD Pipeline

The repository uses GitHub Actions for automated builds and deployments:

### Test Builds (`.github/workflows/test-build.yml`)
- **Triggers:** Push to `dev` branch, pull requests to `dev`
- **Actions:** Builds Docker image to verify it compiles successfully
- **Output:** Build success/failure status in GitHub Actions
- **No deployment:** Test builds do not push to registry or deploy

### Production Deployment (`.github/workflows/deploy.yml`)
- **Triggers:** Push to `master` branch, manual workflow dispatch
- **Actions:**
  1. Builds Docker image
  2. Pushes to GitHub Container Registry (GHCR)
  3. SSHs to remote Docker host
  4. Deploys new container
- **Output:** Live application at `http://REMOTE_HOST:8080/movienight/`

**Workflow:**
```
Feature Branch → PR to dev → Test Build ✓ → Merge to dev → Test Build ✓
                                                    ↓
                                            PR to master → Merge → Deploy 🚀
```

## Prerequisites

### On Remote Docker Host

1. **Docker installed and running**
   ```bash
   docker --version  # Should be v20.10 or higher
   ```

2. **SSH server running**
   ```bash
   sudo systemctl status ssh  # Should be active
   ```

3. **Deployment user with Docker permissions**
   ```bash
   sudo useradd -m -s /bin/bash deploy
   sudo usermod -aG docker deploy
   sudo systemctl restart docker
   ```

4. **Port 8080 available** (or configure different port)

### On Your Local Machine

1. **Git installed**
2. **SSH client** (ssh-keygen, ssh)
3. **Access to GitHub repository settings**

## Initial Setup

### Step 1: Generate SSH Key Pair

```bash
# Generate Ed25519 key (more secure than RSA)
ssh-keygen -t ed25519 -C "github-actions-movienight" -f ~/.ssh/movienight_deploy

# Important: Do NOT set a passphrase (GitHub Actions can't handle interactive prompts)
```

This creates two files:
- `~/.ssh/movienight_deploy` (private key) - Keep this SECRET
- `~/.ssh/movienight_deploy.pub` (public key) - This goes on the server

### Step 2: Configure Remote Host

```bash
# SSH into your remote host
ssh your-user@remote-host

# Switch to deployment user
sudo su - deploy

# Create .ssh directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add your public key
nano ~/.ssh/authorized_keys
# Paste the content of movienight_deploy.pub (from your local machine)

# Set proper permissions
chmod 600 ~/.ssh/authorized_keys

# Exit deploy user
exit

# Test Docker access (should work without sudo)
sudo -u deploy docker ps
```

### Step 3: Test SSH Connection

```bash
# From your local machine
ssh -i ~/.ssh/movienight_deploy deploy@remote-host

# If successful, you should be logged in as 'deploy' user
# Test Docker access
docker ps

# Exit
exit
```

### Step 4: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add the following secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `REMOTE_HOST` | IP address or hostname of your Docker host | `192.168.1.100` or `docker.example.com` |
| `REMOTE_USER` | SSH username (usually `deploy`) | `deploy` |
| `SSH_PRIVATE_KEY` | Content of `~/.ssh/movienight_deploy` file | (entire file including headers) |
| `REMOTE_PORT` | SSH port (optional, defaults to 22) | `22` or `2222` |

**Important for SSH_PRIVATE_KEY:**
- Copy the ENTIRE content of the private key file
- Include the `-----BEGIN OPENSSH PRIVATE KEY-----` header
- Include the `-----END OPENSSH PRIVATE KEY-----` footer
- Paste exactly as-is into the secret value

Example format:
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
[... many more lines ...]
-----END OPENSSH PRIVATE KEY-----
```

## Triggering a Deployment

### Automatic Deployment

Any push to the `master` branch triggers automatic deployment:

```bash
git checkout master
git add .
git commit -m "Your commit message"
git push origin master
```

### Manual Deployment

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Deploy to Remote Docker Host** workflow
4. Click **Run workflow** button
5. Select branch (usually `master`)
6. Click **Run workflow**

## Monitoring Deployment

### View Workflow Status

1. Go to **Actions** tab in GitHub
2. Click on the running workflow
3. Expand each job to see detailed logs

### Check Container Status on Remote Host

```bash
# SSH to remote host
ssh deploy@remote-host

# Check if container is running
docker ps | grep movienight

# View container logs
docker logs movienight

# Follow logs in real-time
docker logs -f movienight
```

## Accessing the Application

After successful deployment:

**URL:** `http://REMOTE_HOST_IP:8080/movienight/`

Example: `http://192.168.1.100:8080/movienight/`

## Verification Checklist

- [ ] Container is running: `docker ps | grep movienight`
- [ ] No errors in logs: `docker logs movienight`
- [ ] Application loads in browser
- [ ] All navigation works
- [ ] Static assets load correctly
- [ ] No console errors in browser DevTools

## Rollback Procedures

### Rollback to Previous Image

```bash
# SSH to remote host
ssh deploy@remote-host

# List available images
docker images | grep movienight

# Stop current container
docker stop movienight
docker rm movienight

# Run previous version (replace TAG with actual tag)
docker run -d \
  --name movienight \
  --restart unless-stopped \
  -p 8080:80 \
  ghcr.io/YOUR_USERNAME/movienight:TAG

# Verify
docker logs movienight
```

### Rollback via Git

```bash
# On your local machine
git log  # Find commit hash to revert to

# Revert to specific commit
git revert COMMIT_HASH

# Or reset to previous commit (destructive - use with caution)
git reset --hard HEAD~1

# Push to trigger redeployment
git push origin master
```

## Troubleshooting

### Deployment Fails at Build Stage

**Symptom:** Build job fails in GitHub Actions

**Solutions:**
1. Check that `package.json` and `package-lock.json` are committed
2. Verify Node.js dependencies are compatible
3. Check GitHub Actions logs for specific npm errors

### Deployment Fails at SSH Stage

**Symptom:** "Permission denied" or "Connection refused"

**Solutions:**
1. Verify `REMOTE_HOST` secret is correct
2. Test SSH connection manually: `ssh -i private_key deploy@host`
3. Check SSH_PRIVATE_KEY format (must include headers)
4. Verify firewall allows SSH on specified port
5. Ensure `deploy` user exists and has Docker permissions

### Container Fails to Start

**Symptom:** Container exits immediately after starting

**Solutions:**
```bash
# SSH to remote host
ssh deploy@remote-host

# Check container logs
docker logs movienight

# Common issues:
# - Port 8080 already in use: Change port in workflow
# - Permission errors: Check user is in docker group
# - Image pull failed: Check GHCR authentication
```

### Application Returns 404

**Symptom:** nginx returns 404 for all routes

**Solutions:**
1. Check nginx.conf is properly copied in Dockerfile
2. Verify build output structure: `docker exec movienight ls -la /usr/share/nginx/html/`
3. Check package.json `homepage` setting matches nginx config

### Image Push to GHCR Fails

**Symptom:** "denied: permission_denied"

**Solutions:**
1. Check repository package settings (may need to make package public)
2. Verify workflow has `packages: write` permission
3. Ensure GITHUB_TOKEN is valid

## Maintenance

### Update Application

```bash
# Make changes to code
git add .
git commit -m "Update application"
git push origin master

# Deployment happens automatically
```

### Update nginx Configuration

```bash
# Edit nginx.conf
nano nginx.conf

# Commit and push
git add nginx.conf
git commit -m "Update nginx config"
git push origin master

# New image will be built with updated config
```

### Clean Up Old Images

```bash
# SSH to remote host
ssh deploy@remote-host

# Remove unused images
docker image prune -f

# Remove specific old images
docker rmi ghcr.io/username/movienight:OLD_TAG
```

### View Resource Usage

```bash
# SSH to remote host
ssh deploy@remote-host

# Container stats
docker stats movienight

# Disk usage
docker system df
```

## Security Best Practices

1. **SSH Key Management**
   - Use Ed25519 keys (more secure)
   - No passphrase on deployment key (stored in GitHub Secrets)
   - Rotate keys every 90 days

2. **Network Security**
   - Consider changing default SSH port
   - Use firewall to restrict SSH access
   - Use HTTPS with reverse proxy for production

3. **Secret Management**
   - Never commit secrets to repository
   - Rotate GitHub Secrets periodically
   - Use GitHub Environments for production deployments

4. **Container Security**
   - Keep base images updated (nginx:alpine)
   - Run containers with restart policies
   - Monitor container logs regularly

## Advanced Configuration

### Using Docker Compose

If `docker-compose.yml` is present:

```bash
# On remote host, create deployment directory
sudo mkdir -p /opt/movienight
sudo chown deploy:deploy /opt/movienight

# Copy docker-compose.yml to remote host
scp docker-compose.yml deploy@remote-host:/opt/movienight/

# Update workflow deploy script to:
cd /opt/movienight
docker-compose pull
docker-compose up -d
docker image prune -f
```

### Custom Domain with SSL

Set up nginx reverse proxy on remote host:

```bash
# Install nginx and certbot
sudo apt install nginx certbot python3-certbot-nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/movienight

# Add configuration:
server {
    listen 80;
    server_name movienight.example.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/movienight /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d movienight.example.com
```

## Local Testing

Before pushing to master, test the Docker build locally:

```bash
# Clone the repo
cd /var/tmp/vibe-kanban/worktrees/5f98-add-github-actio/movienight

# Build the image
docker build -t movienight:test .

# Run locally
docker run -d --name movienight-test -p 9000:80 movienight:test

# Test in browser
open http://localhost:9000/movienight/

# Cleanup
docker stop movienight-test
docker rm movienight-test
```

## Support

For issues or questions:
1. Check workflow logs in GitHub Actions
2. Check container logs on remote host
3. Review this documentation
4. Check GitHub repository issues
