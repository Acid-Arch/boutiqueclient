#!/bin/bash

# Boutique Client Portal - Hetzner Server Deployment Script
# IP-Only Deployment to 5.78.147.68
# This script automates the deployment process for testing without domain setup

set -e  # Exit on any error

# Configuration
SERVER_IP="5.78.147.68"
SERVER_USER="root"  # Will switch to boutique-client user after setup
SERVICE_USER="boutique-client"
APP_DIR="/opt/boutique-client"
LOG_DIR="$APP_DIR/logs"
REPO_URL="${REPO_URL:-git@github.com:yourusername/boutique-client-portal.git}"

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
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running with correct parameters
if [ $# -lt 1 ]; then
    echo "Usage: $0 <action> [options]"
    echo ""
    echo "Actions:"
    echo "  setup     - Initial server setup (run as root)"
    echo "  deploy    - Deploy application code"
    echo "  restart   - Restart services"
    echo "  status    - Check deployment status"
    echo "  logs      - Show application logs"
    echo "  test      - Test deployment"
    echo ""
    echo "Options:"
    echo "  --repo-url=URL    Repository URL (default: auto-detect)"
    echo "  --branch=BRANCH   Git branch to deploy (default: main)"
    echo "  --skip-build      Skip building the application"
    echo "  --skip-deps       Skip installing dependencies"
    echo ""
    exit 1
fi

ACTION=$1
BRANCH=${2:-main}

# Parse additional options
for arg in "$@"; do
    case $arg in
        --repo-url=*)
            REPO_URL="${arg#*=}"
            shift
            ;;
        --branch=*)
            BRANCH="${arg#*=}"
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
    esac
done

# Function to run commands on remote server
run_remote() {
    local user=$1
    local cmd=$2
    log "Running on server as $user: $cmd"
    ssh -o StrictHostKeyChecking=no "$user@$SERVER_IP" "$cmd"
}

# Function to copy files to server
copy_to_server() {
    local local_file=$1
    local remote_path=$2
    local user=${3:-$SERVER_USER}
    log "Copying $local_file to $user@$SERVER_IP:$remote_path"
    scp -o StrictHostKeyChecking=no "$local_file" "$user@$SERVER_IP:$remote_path"
}

# Initial server setup
setup_server() {
    log "Starting initial server setup on $SERVER_IP"
    
    # System updates and package installation
    log "Updating system and installing packages..."
    run_remote root "apt-get update && apt-get upgrade -y"
    run_remote root "apt-get install -y curl git nginx postgresql-client ufw fail2ban htop vim unzip"
    
    # Install Node.js 18.x
    log "Installing Node.js..."
    run_remote root "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    run_remote root "apt-get install -y nodejs"
    
    # Install PM2 globally
    log "Installing PM2..."
    run_remote root "npm install -g pm2"
    
    # Create service user
    log "Creating service user: $SERVICE_USER"
    run_remote root "useradd -m -s /bin/bash $SERVICE_USER || true"
    run_remote root "usermod -aG sudo $SERVICE_USER || true"
    
    # Create directory structure
    log "Creating directory structure..."
    run_remote root "mkdir -p $APP_DIR $LOG_DIR"
    run_remote root "chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR"
    run_remote root "chmod -R 755 $APP_DIR"
    
    # Configure UFW firewall
    log "Configuring firewall..."
    run_remote root "ufw --force reset"
    run_remote root "ufw default deny incoming"
    run_remote root "ufw default allow outgoing"
    run_remote root "ufw allow ssh"
    run_remote root "ufw allow 80/tcp"
    run_remote root "ufw allow 3000/tcp"  # SvelteKit app
    run_remote root "ufw allow 8081/tcp"  # WebSocket
    run_remote root "ufw --force enable"
    
    # Copy and configure Nginx
    log "Configuring Nginx..."
    copy_to_server "nginx-production-ip.conf" "/etc/nginx/sites-available/boutique-client" root
    run_remote root "ln -sf /etc/nginx/sites-available/boutique-client /etc/nginx/sites-enabled/"
    run_remote root "rm -f /etc/nginx/sites-enabled/default"
    run_remote root "nginx -t"
    run_remote root "systemctl enable nginx"
    run_remote root "systemctl restart nginx"
    
    # Configure fail2ban
    log "Configuring fail2ban..."
    run_remote root "systemctl enable fail2ban"
    run_remote root "systemctl start fail2ban"
    
    log "✅ Server setup completed successfully!"
    log "Next steps: run '$0 deploy' to deploy the application"
}

# Deploy application
deploy_app() {
    log "Starting application deployment..."
    
    # Switch to service user for deployment
    log "Cloning/updating repository..."
    run_remote $SERVICE_USER "cd $APP_DIR && { 
        if [ -d app/.git ]; then 
            cd app && git fetch origin && git reset --hard origin/$BRANCH && git clean -fd
        else 
            rm -rf app && git clone $REPO_URL app && cd app && git checkout $BRANCH
        fi
    }"
    
    # Install dependencies
    if [ "$SKIP_DEPS" != true ]; then
        log "Installing dependencies..."
        run_remote $SERVICE_USER "cd $APP_DIR/app && npm ci --production"
    fi
    
    # Copy environment file
    log "Configuring environment..."
    run_remote $SERVICE_USER "cd $APP_DIR/app && cp .env.production .env"
    
    # Generate Prisma client
    log "Generating Prisma client..."
    run_remote $SERVICE_USER "cd $APP_DIR/app && PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate"
    
    # Run database migrations (if needed)
    log "Running database migrations..."
    run_remote $SERVICE_USER "cd $APP_DIR/app && PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy || true"
    
    # Switch to IP-only authentication
    log "Configuring IP-only authentication..."
    run_remote $SERVICE_USER "cd $APP_DIR/app/src && { 
        [ -f auth.ts ] && mv auth.ts auth-oauth.ts.backup || true
        [ -f auth-ip-only.ts ] && cp auth-ip-only.ts auth.ts || true
    }"
    
    # Build application
    if [ "$SKIP_BUILD" != true ]; then
        log "Building application..."
        run_remote $SERVICE_USER "cd $APP_DIR/app && NODE_ENV=production npm run build"
    fi
    
    # Start/restart with PM2
    log "Starting application with PM2..."
    run_remote $SERVICE_USER "cd $APP_DIR/app && {
        pm2 delete boutique-client-portal || true
        pm2 delete boutique-websocket-server || true
        pm2 start ecosystem.config.js --env production
        pm2 save
    }"
    
    # Setup PM2 startup (as root)
    log "Configuring PM2 startup..."
    run_remote root "env PATH=\$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $SERVICE_USER --hp /home/$SERVICE_USER"
    
    log "✅ Application deployment completed successfully!"
}

# Restart services
restart_services() {
    log "Restarting services..."
    run_remote $SERVICE_USER "cd $APP_DIR/app && pm2 restart all"
    run_remote root "systemctl restart nginx"
    log "✅ Services restarted successfully!"
}

# Check deployment status
check_status() {
    log "Checking deployment status..."
    
    echo "=== PM2 Status ==="
    run_remote $SERVICE_USER "pm2 status"
    
    echo "=== Nginx Status ==="
    run_remote root "systemctl status nginx --no-pager"
    
    echo "=== Server Health Check ==="
    if curl -f -s "http://$SERVER_IP:3000/api/admin/health" > /dev/null; then
        log "✅ Health check passed"
    else
        error "❌ Health check failed"
    fi
    
    echo "=== UFW Status ==="
    run_remote root "ufw status"
    
    log "Status check completed!"
}

# Show logs
show_logs() {
    local service=${2:-boutique-client-portal}
    log "Showing logs for $service..."
    run_remote $SERVICE_USER "pm2 logs $service --lines 50"
}

# Test deployment
test_deployment() {
    log "Testing deployment..."
    
    local base_url="http://$SERVER_IP:3000"
    
    # Test health endpoint
    info "Testing health endpoint..."
    if curl -f -s "$base_url/api/admin/health"; then
        log "✅ Health endpoint working"
    else
        error "❌ Health endpoint failed"
    fi
    
    # Test main page
    info "Testing main page..."
    if curl -f -s "$base_url/" > /dev/null; then
        log "✅ Main page accessible"
    else
        error "❌ Main page failed"
    fi
    
    # Test login page
    info "Testing login page..."
    if curl -f -s "$base_url/login" > /dev/null; then
        log "✅ Login page accessible"
    else
        error "❌ Login page failed"
    fi
    
    log "🎉 Deployment test completed!"
    log "Access your application at: $base_url"
    log "Login with: admin / boutique2024!"
}

# Main execution
case $ACTION in
    setup)
        setup_server
        ;;
    deploy)
        deploy_app
        ;;
    restart)
        restart_services
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs "$@"
        ;;
    test)
        test_deployment
        ;;
    *)
        error "Unknown action: $ACTION"
        exit 1
        ;;
esac

log "🚀 Action '$ACTION' completed successfully!"