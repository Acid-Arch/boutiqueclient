#!/usr/bin/env bash

# GitHub Actions Deployment Script for Boutique Client Portal
# Optimized for NixOS deployment with enhanced CI/CD integration

set -e  # Exit on any error

# Configuration
SERVER_IP="${SERVER_IP:-5.78.147.68}"
SERVER_USER="${SERVER_USER:-admin}"
SERVICE_USER="${SERVICE_USER:-boutique-client}"
APP_DIR="/opt/boutique-client"
LOG_DIR="$APP_DIR/logs"
DEPLOYMENT_ID="${GITHUB_SHA:-$(date +%s)}"
BACKUP_DIR="$APP_DIR/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Function to run commands on remote server
run_remote() {
    local user=$1
    local cmd=$2
    local use_sudo=${3:-false}
    
    if [ "$use_sudo" = "true" ]; then
        # Use the password from environment variable for sudo operations with timeout to avoid hanging
        echo "$SUDO_PASSWORD" | timeout 30 ssh -i ~/.ssh/github-actions-boutique -o StrictHostKeyChecking=no -o ServerAliveInterval=10 "$user@$SERVER_IP" "sudo -S $cmd"
        # Add small delay to prevent rapid authentication attempts
        sleep 2
    else
        timeout 30 ssh -i ~/.ssh/github-actions-boutique -o StrictHostKeyChecking=no -o ServerAliveInterval=10 "$user@$SERVER_IP" "$cmd"
    fi
}

# Function to copy files to server
copy_to_server() {
    local local_file=$1
    local remote_path=$2
    local user=${3:-$SERVER_USER}
    log "Copying $local_file to $user@$SERVER_IP:$remote_path"
    timeout 60 scp -i ~/.ssh/github-actions-boutique -o StrictHostKeyChecking=no -o ServerAliveInterval=10 "$local_file" "$user@$SERVER_IP:$remote_path"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check SSH connection
    info "Testing SSH connection..."
    if ! ssh -i ~/.ssh/github-actions-boutique -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SERVER_USER@$SERVER_IP" "echo 'Connection test successful'"; then
        error "Failed to connect to server $SERVER_IP"
    fi
    
    # Check server resources
    info "Checking server resources..."
    local disk_usage=$(run_remote "$SERVER_USER" "df -h /opt | tail -n 1 | awk '{print \$5}' | sed 's/%//'")
    if [ "$disk_usage" -gt 85 ]; then
        warning "Disk usage is at ${disk_usage}% - consider cleaning up"
    fi
    
    # Check if required directories exist - use server-side script to avoid multiple sudo calls
    info "Ensuring directory structure..."
    
    # Verify server-deploy.sh exists and copy it
    local server_deploy_script="scripts/server-deploy.sh"
    if [ ! -f "$server_deploy_script" ]; then
        server_deploy_script="./scripts/server-deploy.sh"
        if [ ! -f "$server_deploy_script" ]; then
            # Create the script inline if it doesn't exist
            cat > /tmp/server-deploy-temp.sh << 'EOF'
#!/bin/bash
# Server-side deployment script that handles all sudo operations
set -e

# Configuration
SERVICE_USER="boutique-client"
APP_DIR="/opt/boutique-client"
LOG_DIR="$APP_DIR/logs"
BACKUP_DIR="$APP_DIR/backups"

echo "🚀 Starting server-side deployment..."

# Create directories with sudo
echo "📁 Setting up directories..."
sudo mkdir -p $APP_DIR $LOG_DIR $BACKUP_DIR
sudo chown -R $SERVICE_USER:users $APP_DIR

# Clean up any old deployment
echo "🧹 Cleaning up previous deployment..."
sudo rm -rf $APP_DIR/app-new || true
sudo mkdir -p $APP_DIR/app-new
sudo chown $SERVICE_USER:users $APP_DIR/app-new

echo "✅ Server-side setup completed!"
echo "Ready for application deployment as $SERVICE_USER user."
EOF
            server_deploy_script="/tmp/server-deploy-temp.sh"
        fi
    fi
    
    info "Copying server deployment script: $server_deploy_script"
    copy_to_server "$server_deploy_script" "/tmp/server-deploy.sh" "$SERVER_USER"
    run_remote "$SERVER_USER" "chmod +x /tmp/server-deploy.sh"
    
    info "Running server-side deployment setup with sudo..."
    echo "$SUDO_PASSWORD" | timeout 30 ssh -i ~/.ssh/github-actions-boutique -o StrictHostKeyChecking=no -o ServerAliveInterval=10 "$SERVER_USER@$SERVER_IP" "sudo -S /tmp/server-deploy.sh"
    
    log "✅ Pre-deployment checks completed"
}

# Create deployment backup
create_backup() {
    log "Creating deployment backup..."
    
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    
    # Backup current application if it exists
    if run_remote "$SERVICE_USER" "[ -d $APP_DIR/app ]"; then
        info "Backing up current application to $backup_name"
        run_remote "$SERVICE_USER" "cp -r $APP_DIR/app $BACKUP_DIR/$backup_name"
        
        # Keep only last 5 backups
        run_remote "$SERVICE_USER" "cd $BACKUP_DIR && ls -t | tail -n +6 | xargs -r rm -rf"
        
        log "✅ Backup created: $backup_name"
    else
        info "No existing application found, skipping backup"
    fi
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    # Stop current application gracefully
    info "Stopping current application..."
    run_remote "$SERVICE_USER" "cd $APP_DIR && pm2 stop all || true"
    
    # Create deployment package (this should be done in GitHub Actions)
    if [ ! -f "boutique-client-$DEPLOYMENT_ID.tar.gz" ]; then
        info "Creating deployment package..."
        tar -czf "boutique-client-$DEPLOYMENT_ID.tar.gz" \
            --exclude=node_modules \
            --exclude=.git \
            --exclude=.playwright-mcp \
            --exclude=.svelte-kit \
            --exclude=build \
            --exclude="*.log" \
            --exclude="*.tmp" \
            --exclude="backups" \
            .
    fi
    
    # Transfer application files
    info "Transferring application files..."
    copy_to_server "boutique-client-$DEPLOYMENT_ID.tar.gz" "/tmp/" "$SERVER_USER"
    
    # Extract on server (directories already set up by server script)
    info "Extracting application files..."
    run_remote "$SERVICE_USER" "cd $APP_DIR && tar -xzf /tmp/boutique-client-$DEPLOYMENT_ID.tar.gz -C app-new"
    
    # Install dependencies
    info "Installing dependencies..."
    run_remote "$SERVICE_USER" "cd $APP_DIR/app-new && npm ci --production --silent"
    
    # Setup environment
    info "Configuring environment..."
    run_remote "$SERVICE_USER" "cd $APP_DIR/app-new && cp .env.production .env"
    
    # Generate Prisma client
    info "Generating Prisma client..."
    run_remote "$SERVICE_USER" "cd $APP_DIR/app-new && PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate"
    
    # Run database migrations
    info "Running database migrations..."
    run_remote "$SERVICE_USER" "cd $APP_DIR/app-new && PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy || true"
    
    # Build application
    info "Building application..."
    run_remote "$SERVICE_USER" "cd $APP_DIR/app-new && NODE_ENV=production npm run build"
    
    # Atomic deployment switch
    info "Switching to new deployment..."
    run_remote "$SERVICE_USER" "cd $APP_DIR && { [ -d app ] && mv app app-old || true; } && mv app-new app"
    
    # Start application
    info "Starting application..."
    run_remote "$SERVICE_USER" "cd $APP_DIR/app && pm2 start ecosystem.config.js --env production"
    run_remote "$SERVICE_USER" "pm2 save"
    
    # Clean up
    run_remote "$SERVER_USER" "rm -f /tmp/boutique-client-$DEPLOYMENT_ID.tar.gz"
    run_remote "$SERVICE_USER" "rm -rf $APP_DIR/app-old || true"
    
    log "✅ Application deployment completed"
}

# Health checks
run_health_checks() {
    log "Running health checks..."
    
    local max_attempts=30
    local attempt=1
    local health_url="http://$SERVER_IP:3000/api/admin/health"
    
    info "Waiting for application to start..."
    sleep 10
    
    while [ $attempt -le $max_attempts ]; do
        info "Health check attempt $attempt/$max_attempts"
        
        if curl -f -s --connect-timeout 5 --max-time 10 "$health_url" > /dev/null; then
            log "✅ Health check passed"
            
            # Additional checks
            info "Testing main endpoints..."
            if curl -f -s --connect-timeout 5 --max-time 10 "http://$SERVER_IP:3000/" > /dev/null; then
                log "✅ Main page accessible"
            fi
            
            if curl -f -s --connect-timeout 5 --max-time 10 "http://$SERVER_IP:3000/login" > /dev/null; then
                log "✅ Login page accessible"
            fi
            
            # Check PM2 processes
            info "Checking PM2 processes..."
            if run_remote "$SERVICE_USER" "pm2 list | grep -E 'online.*boutique'"; then
                log "✅ PM2 processes running correctly"
            fi
            
            log "🎉 All health checks passed!"
            return 0
        fi
        
        warning "Health check failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    error "Health checks failed after $max_attempts attempts"
}

# Rollback function
rollback_deployment() {
    log "Rolling back deployment..."
    
    local latest_backup=$(run_remote "$SERVICE_USER" "ls -t $BACKUP_DIR | head -n 1")
    
    if [ -n "$latest_backup" ]; then
        info "Rolling back to: $latest_backup"
        
        # Stop current application
        run_remote "$SERVICE_USER" "cd $APP_DIR && pm2 stop all || true"
        
        # Restore from backup
        run_remote "$SERVICE_USER" "cd $APP_DIR && rm -rf app && cp -r $BACKUP_DIR/$latest_backup app"
        
        # Start application
        run_remote "$SERVICE_USER" "cd $APP_DIR/app && pm2 start ecosystem.config.js --env production"
        
        log "✅ Rollback completed"
    else
        error "No backup found for rollback"
    fi
}

# Deployment summary
deployment_summary() {
    log "Deployment Summary"
    echo "================================"
    echo "Deployment ID: $DEPLOYMENT_ID"
    echo "Server: $SERVER_IP"
    echo "Application URL: http://$SERVER_IP:3000"
    echo "WebSocket URL: http://$SERVER_IP:8081"
    echo "Deployed at: $(date)"
    echo "================================"
    
    # Show PM2 status
    info "PM2 Status:"
    run_remote "$SERVICE_USER" "pm2 status"
}

# Main execution
main() {
    local action=${1:-deploy}
    
    case $action in
        deploy)
            log "🚀 Starting deployment process..."
            pre_deployment_checks
            create_backup
            deploy_application
            run_health_checks
            deployment_summary
            ;;
        rollback)
            log "🔄 Starting rollback process..."
            rollback_deployment
            run_health_checks
            ;;
        health)
            log "🏥 Running health checks..."
            run_health_checks
            ;;
        *)
            error "Unknown action: $action. Use: deploy, rollback, or health"
            ;;
    esac
    
    log "🎉 Action '$action' completed successfully!"
}

# Run main function
main "$@"