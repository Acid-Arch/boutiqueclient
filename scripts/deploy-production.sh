#!/bin/bash

# =============================================================================
# Production Deployment Script for Boutique Client Portal
# =============================================================================
#
# This script handles deployment to production servers without Docker
# Supports deployment strategies: direct, systemd, PM2
#
# Usage:
#   ./deploy-production.sh [options]
#
# Options:
#   --strategy=<direct|systemd|pm2>  Deployment strategy (default: systemd)
#   --host=<hostname>                Target production server
#   --user=<username>                SSH username for deployment
#   --branch=<branch>                Git branch to deploy (default: main)
#   --no-build                       Skip build step
#   --no-migrate                     Skip database migrations
#   --no-restart                     Skip service restart
#   --rollback                       Rollback to previous version
#   --dry-run                        Show what would be done
#
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Default configuration
DEFAULT_STRATEGY="systemd"
DEFAULT_BRANCH="main"
DEFAULT_USER="deploy"
DEFAULT_APP_DIR="/opt/boutique-client"
DEFAULT_SERVICE_NAME="boutique-client"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Utility Functions
# =============================================================================

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

confirm() {
    local prompt="$1"
    local response
    read -p "$(echo -e "${YELLOW}$prompt [y/N]:${NC} ")" response
    [[ "$response" =~ ^[Yy]$ ]]
}

# =============================================================================
# Configuration Parsing
# =============================================================================

parse_args() {
    STRATEGY="$DEFAULT_STRATEGY"
    BRANCH="$DEFAULT_BRANCH"
    USER="$DEFAULT_USER"
    HOST=""
    APP_DIR="$DEFAULT_APP_DIR"
    SERVICE_NAME="$DEFAULT_SERVICE_NAME"
    
    SKIP_BUILD=false
    SKIP_MIGRATE=false
    SKIP_RESTART=false
    DRY_RUN=false
    ROLLBACK=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --strategy=*)
                STRATEGY="${1#*=}"
                shift
                ;;
            --host=*)
                HOST="${1#*=}"
                shift
                ;;
            --user=*)
                USER="${1#*=}"
                shift
                ;;
            --branch=*)
                BRANCH="${1#*=}"
                shift
                ;;
            --app-dir=*)
                APP_DIR="${1#*=}"
                shift
                ;;
            --service-name=*)
                SERVICE_NAME="${1#*=}"
                shift
                ;;
            --no-build)
                SKIP_BUILD=true
                shift
                ;;
            --no-migrate)
                SKIP_MIGRATE=true
                shift
                ;;
            --no-restart)
                SKIP_RESTART=true
                shift
                ;;
            --rollback)
                ROLLBACK=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done

    # Validate required parameters
    if [[ -z "$HOST" ]]; then
        error "Host is required. Use --host=<hostname>"
    fi

    if [[ ! "$STRATEGY" =~ ^(direct|systemd|pm2)$ ]]; then
        error "Invalid strategy. Use: direct, systemd, or pm2"
    fi
}

show_help() {
    cat << EOF
Production Deployment Script for Boutique Client Portal

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --strategy=<direct|systemd|pm2>  Deployment strategy (default: systemd)
    --host=<hostname>                Target production server
    --user=<username>                SSH username (default: deploy)
    --branch=<branch>                Git branch to deploy (default: main)
    --app-dir=<path>                 Application directory (default: /opt/boutique-client)
    --service-name=<name>            Service name (default: boutique-client)
    --no-build                       Skip build step
    --no-migrate                     Skip database migrations
    --no-restart                     Skip service restart
    --rollback                       Rollback to previous version
    --dry-run                        Show what would be done
    -h, --help                       Show this help

EXAMPLES:
    # Deploy to production with systemd
    $0 --host=prod.example.com --user=deploy

    # Deploy specific branch with PM2
    $0 --host=prod.example.com --strategy=pm2 --branch=release/v2.0

    # Rollback deployment
    $0 --host=prod.example.com --rollback
EOF
}

# =============================================================================
# Pre-deployment Checks
# =============================================================================

pre_deployment_checks() {
    log "Running pre-deployment checks..."

    # Check if we can SSH to the target host
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$USER@$HOST" exit 2>/dev/null; then
        error "Cannot SSH to $USER@$HOST. Check SSH key authentication."
    fi

    # Check Git repository status
    if ! git diff --quiet HEAD; then
        warning "Working directory has uncommitted changes"
        if ! confirm "Continue deployment?"; then
            exit 1
        fi
    fi

    # Check if branch exists
    if ! git rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1; then
        error "Branch 'origin/$BRANCH' does not exist"
    fi

    # Check Node.js version locally
    local node_version
    node_version=$(node --version | cut -d'v' -f2)
    if [[ ! "$node_version" =~ ^(18|20|22)\. ]]; then
        warning "Local Node.js version $node_version may not be compatible"
    fi

    success "Pre-deployment checks passed"
}

# =============================================================================
# Build Application
# =============================================================================

build_application() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log "Skipping build step"
        return 0
    fi

    log "Building application..."

    # Install dependencies
    log "Installing dependencies..."
    npm ci --only=production

    # Run type check
    log "Running type check..."
    npm run check

    # Build application
    log "Building for production..."
    npm run build

    success "Application built successfully"
}

# =============================================================================
# Create Deployment Package
# =============================================================================

create_deployment_package() {
    log "Creating deployment package..."

    local package_name="boutique-client-${DEPLOY_TIMESTAMP}.tar.gz"
    local temp_dir=$(mktemp -d)

    # Copy necessary files
    cp -r build/ "$temp_dir/"
    cp -r static/ "$temp_dir/"
    cp package.json package-lock.json "$temp_dir/"
    cp -r prisma/ "$temp_dir/"
    cp -r scripts/ "$temp_dir/"

    # Copy infrastructure configs
    if [[ -d infrastructure/ ]]; then
        cp -r infrastructure/ "$temp_dir/"
    fi

    # Create environment file template
    cp .env.production.example "$temp_dir/.env.production"

    # Create service files
    create_service_files "$temp_dir"

    # Create archive
    tar -czf "/tmp/$package_name" -C "$temp_dir" .
    rm -rf "$temp_dir"

    echo "/tmp/$package_name"
}

# =============================================================================
# Service File Generation
# =============================================================================

create_service_files() {
    local target_dir="$1"

    # Create systemd service file
    cat > "$target_dir/boutique-client.service" << EOF
[Unit]
Description=Boutique Client Portal
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node build/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=boutique-client

# Environment
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIR/.env.production

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR/logs
PrivateTmp=true

# Resource limits
LimitNOFILE=65536
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

    # Create PM2 ecosystem file
    cat > "$target_dir/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: '$SERVICE_NAME',
    script: './build/index.js',
    cwd: '$APP_DIR',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '$APP_DIR/logs/error.log',
    out_file: '$APP_DIR/logs/out.log',
    log_file: '$APP_DIR/logs/combined.log',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    wait_ready: true,
    listen_timeout: 10000,
    kill_timeout: 5000,
    max_restarts: 3,
    min_uptime: '10s'
  }]
};
EOF

    # Create nginx site configuration
    cat > "$target_dir/nginx-site.conf" << EOF
# Copy this to /etc/nginx/sites-available/$SERVICE_NAME
# Create symlink: ln -s /etc/nginx/sites-available/$SERVICE_NAME /etc/nginx/sites-enabled/

# Include the main nginx configuration
include $APP_DIR/infrastructure/nginx/nginx.conf;
EOF
}

# =============================================================================
# Deployment Strategies
# =============================================================================

deploy_direct() {
    log "Deploying with direct strategy..."

    local package_path="$1"
    local remote_temp="/tmp/boutique-client-${DEPLOY_TIMESTAMP}"

    # Upload package
    scp "$package_path" "$USER@$HOST:/tmp/"
    
    # Extract and setup on remote
    ssh "$USER@$HOST" << EOF
        set -e
        sudo mkdir -p $APP_DIR/releases/$DEPLOY_TIMESTAMP
        sudo tar -xzf /tmp/$(basename "$package_path") -C $APP_DIR/releases/$DEPLOY_TIMESTAMP
        
        # Install dependencies
        cd $APP_DIR/releases/$DEPLOY_TIMESTAMP
        sudo npm ci --only=production
        
        # Create symlink
        sudo rm -f $APP_DIR/current
        sudo ln -sf $APP_DIR/releases/$DEPLOY_TIMESTAMP $APP_DIR/current
        
        # Create logs directory
        sudo mkdir -p $APP_DIR/logs
        sudo chown -R www-data:www-data $APP_DIR
        
        # Cleanup old releases (keep last 3)
        cd $APP_DIR/releases
        sudo ls -t | tail -n +4 | xargs -r sudo rm -rf
EOF
}

deploy_systemd() {
    log "Deploying with systemd strategy..."

    local package_path="$1"
    
    # Deploy files
    deploy_direct "$package_path"
    
    # Setup systemd service
    ssh "$USER@$HOST" << EOF
        set -e
        
        # Install service file
        sudo cp $APP_DIR/current/boutique-client.service /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable $SERVICE_NAME
        
        # Setup nginx if needed
        if [[ -f $APP_DIR/current/nginx-site.conf ]]; then
            sudo cp $APP_DIR/current/infrastructure/nginx/nginx.conf /etc/nginx/sites-available/$SERVICE_NAME
            sudo ln -sf /etc/nginx/sites-available/$SERVICE_NAME /etc/nginx/sites-enabled/
            sudo nginx -t && sudo systemctl reload nginx
        fi
EOF
}

deploy_pm2() {
    log "Deploying with PM2 strategy..."

    local package_path="$1"
    
    # Deploy files
    deploy_direct "$package_path"
    
    # Setup PM2
    ssh "$USER@$HOST" << EOF
        set -e
        
        # Install PM2 globally if not present
        if ! command -v pm2 &> /dev/null; then
            sudo npm install -g pm2
        fi
        
        cd $APP_DIR/current
        
        # Start/restart application
        if pm2 list | grep -q "$SERVICE_NAME"; then
            pm2 reload ecosystem.config.js --update-env
        else
            pm2 start ecosystem.config.js
        fi
        
        # Save PM2 process list
        pm2 save
        
        # Setup PM2 startup script
        sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
EOF
}

# =============================================================================
# Database Migration
# =============================================================================

run_migrations() {
    if [[ "$SKIP_MIGRATE" == "true" ]]; then
        log "Skipping database migrations"
        return 0
    fi

    log "Running database migrations..."

    ssh "$USER@$HOST" << EOF
        set -e
        cd $APP_DIR/current
        
        # Check database connection
        if ! timeout 10 npx prisma db pull --schema prisma/schema.prisma; then
            echo "Database connection failed"
            exit 1
        fi
        
        # Run migrations
        PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy
        
        # Generate Prisma client
        PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate
EOF

    success "Database migrations completed"
}

# =============================================================================
# Service Management
# =============================================================================

restart_services() {
    if [[ "$SKIP_RESTART" == "true" ]]; then
        log "Skipping service restart"
        return 0
    fi

    log "Restarting services..."

    case "$STRATEGY" in
        systemd)
            ssh "$USER@$HOST" "sudo systemctl restart $SERVICE_NAME"
            ssh "$USER@$HOST" "sudo systemctl status $SERVICE_NAME --no-pager"
            ;;
        pm2)
            ssh "$USER@$HOST" "cd $APP_DIR/current && pm2 restart $SERVICE_NAME"
            ;;
        direct)
            warning "Direct strategy requires manual service restart"
            ;;
    esac

    success "Services restarted"
}

# =============================================================================
# Rollback Function
# =============================================================================

rollback_deployment() {
    log "Rolling back deployment..."

    ssh "$USER@$HOST" << EOF
        set -e
        cd $APP_DIR/releases
        
        # Find previous release
        PREVIOUS=\$(ls -t | head -2 | tail -1)
        if [[ -z "\$PREVIOUS" ]]; then
            echo "No previous release found"
            exit 1
        fi
        
        echo "Rolling back to: \$PREVIOUS"
        
        # Update symlink
        sudo rm -f $APP_DIR/current
        sudo ln -sf $APP_DIR/releases/\$PREVIOUS $APP_DIR/current
EOF

    # Restart services after rollback
    restart_services

    success "Rollback completed"
}

# =============================================================================
# Health Check
# =============================================================================

health_check() {
    log "Running health check..."

    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if ssh "$USER@$HOST" "curl -f -s http://localhost:3000/health" >/dev/null 2>&1; then
            success "Health check passed"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, waiting..."
        sleep 10
        ((attempt++))
    done

    error "Health check failed after $max_attempts attempts"
}

# =============================================================================
# Main Deployment Flow
# =============================================================================

main() {
    log "Starting production deployment..."
    log "Strategy: $STRATEGY"
    log "Target: $USER@$HOST"
    log "Branch: $BRANCH"
    log "App Directory: $APP_DIR"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN - No actual changes will be made"
        return 0
    fi

    if [[ "$ROLLBACK" == "true" ]]; then
        rollback_deployment
        health_check
        return 0
    fi

    # Deployment steps
    pre_deployment_checks
    build_application
    
    local package_path
    package_path=$(create_deployment_package)
    
    log "Deployment package: $package_path"

    case "$STRATEGY" in
        direct)
            deploy_direct "$package_path"
            ;;
        systemd)
            deploy_systemd "$package_path"
            ;;
        pm2)
            deploy_pm2 "$package_path"
            ;;
    esac

    run_migrations
    restart_services
    health_check

    # Cleanup
    rm -f "$package_path"

    success "Deployment completed successfully!"
    log "Application is now running at: https://$HOST"
}

# =============================================================================
# Script Execution
# =============================================================================

# Trap errors
trap 'error "Deployment failed at line $LINENO"' ERR

# Parse arguments and run main function
parse_args "$@"
main