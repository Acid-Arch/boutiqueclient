#!/usr/bin/env bash

# Simple deployment script for admin user on Hetzner server
# Since we have admin access but need manual sudo setup, we'll prepare files first

set -e

SERVER_IP="5.78.147.68"
SERVER_USER="admin"
APP_DIR="/home/admin/boutique-client"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Function to run commands on remote server
run_remote() {
    local cmd=$1
    log "Running on server: $cmd"
    ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$cmd"
}

# Check server access
log "Testing server access..."
run_remote "whoami && echo 'Server access confirmed'"

# Create app directory in user space
log "Creating application directory..."
run_remote "mkdir -p $APP_DIR/{app,logs}"

# Create a tarball of the project (excluding node_modules, .git, etc)
log "Creating deployment package..."
tar -czf boutique-client.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=.playwright-mcp \
    --exclude=.svelte-kit \
    --exclude=build \
    --exclude="*.log" \
    --exclude="*.tmp" \
    .

# Transfer the application
log "Transferring application files..."
scp boutique-client.tar.gz "$SERVER_USER@$SERVER_IP:$APP_DIR/"

# Extract and setup on server
log "Extracting files on server..."
run_remote "cd $APP_DIR && tar -xzf boutique-client.tar.gz -C app --strip-components=0"

# Copy environment file
log "Setting up environment..."
run_remote "cd $APP_DIR/app && cp .env.production .env"

# Switch to IP-only authentication
log "Configuring IP-only authentication..."
run_remote "cd $APP_DIR/app/src && { 
    [ -f auth.ts ] && mv auth.ts auth-oauth.ts.backup || true
    [ -f auth-ip-only.ts ] && cp auth-ip-only.ts auth.ts || true
}"

# Create a setup script for sudo operations
log "Creating setup script for sudo operations..."
cat > setup-server.sh << 'EOF'
#!/bin/bash
# Run this script with sudo on the server

echo "Installing system dependencies..."
apt-get update
apt-get install -y curl git nginx postgresql-client ufw fail2ban htop vim unzip

echo "Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

echo "Installing PM2 globally..."
npm install -g pm2

echo "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 3000/tcp
ufw allow 8081/tcp
ufw --force enable

echo "Creating service user..."
useradd -m -s /bin/bash boutique-client || true
mkdir -p /opt/boutique-client
chown -R boutique-client:boutique-client /opt/boutique-client

echo "System setup completed!"
EOF

# Transfer setup script
scp setup-server.sh "$SERVER_USER@$SERVER_IP:$APP_DIR/"

# Clean up local files
rm boutique-client.tar.gz setup-server.sh

log "✅ Application transferred successfully!"
echo
echo "Next steps:"
echo "1. SSH to server: ssh $SERVER_USER@$SERVER_IP"
echo "2. Run setup script: sudo bash $APP_DIR/setup-server.sh"
echo "3. Then continue with: ./deploy-simple.sh continue"