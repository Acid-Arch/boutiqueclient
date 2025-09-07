#!/bin/bash

# =============================================================================
# Production Server Setup Script for Boutique Client Portal
# =============================================================================
#
# This script configures a fresh server for production deployment
# Includes: system updates, dependencies, users, security, services
#
# Usage:
#   ./setup-production-server.sh [options]
#
# Options:
#   --domain=<domain>               Production domain (required)
#   --email=<email>                 Admin email for notifications
#   --user=<username>               Application user (default: boutique)
#   --app-dir=<path>                Application directory (default: /opt/boutique-client)
#   --node-version=<version>        Node.js version (default: 18)
#   --install-nginx                 Install and configure nginx
#   --setup-firewall                Configure UFW firewall
#   --dry-run                       Test configuration without applying
#
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default configuration
DEFAULT_USER="boutique"
DEFAULT_APP_DIR="/opt/boutique-client"
DEFAULT_NODE_VERSION="18"
DEFAULT_INSTALL_NGINX=true
DEFAULT_SETUP_FIREWALL=true

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
    DOMAIN=""
    EMAIL=""
    APP_USER="$DEFAULT_USER"
    APP_DIR="$DEFAULT_APP_DIR"
    NODE_VERSION="$DEFAULT_NODE_VERSION"
    INSTALL_NGINX="$DEFAULT_INSTALL_NGINX"
    SETUP_FIREWALL="$DEFAULT_SETUP_FIREWALL"
    DRY_RUN=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain=*)
                DOMAIN="${1#*=}"
                shift
                ;;
            --email=*)
                EMAIL="${1#*=}"
                shift
                ;;
            --user=*)
                APP_USER="${1#*=}"
                shift
                ;;
            --app-dir=*)
                APP_DIR="${1#*=}"
                shift
                ;;
            --node-version=*)
                NODE_VERSION="${1#*=}"
                shift
                ;;
            --install-nginx)
                INSTALL_NGINX=true
                shift
                ;;
            --no-nginx)
                INSTALL_NGINX=false
                shift
                ;;
            --setup-firewall)
                SETUP_FIREWALL=true
                shift
                ;;
            --no-firewall)
                SETUP_FIREWALL=false
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
    if [[ -z "$DOMAIN" ]]; then
        error "Domain is required. Use --domain=<your-domain.com>"
    fi
}

show_help() {
    cat << EOF
Production Server Setup Script for Boutique Client Portal

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --domain=<domain>               Production domain (required)
    --email=<email>                 Admin email for notifications
    --user=<username>               Application user (default: boutique)
    --app-dir=<path>                Application directory (default: /opt/boutique-client)
    --node-version=<version>        Node.js version (default: 18)
    --install-nginx                 Install and configure nginx (default)
    --no-nginx                      Skip nginx installation
    --setup-firewall                Configure UFW firewall (default)
    --no-firewall                   Skip firewall setup
    --dry-run                       Test configuration without applying
    -h, --help                      Show this help

EXAMPLES:
    # Basic production server setup
    $0 --domain=boutique.example.com --email=admin@example.com

    # Custom user and directory
    $0 --domain=boutique.example.com --user=myapp --app-dir=/var/www/boutique

    # Test configuration
    $0 --domain=boutique.example.com --dry-run
EOF
}

# =============================================================================
# System Prerequisites
# =============================================================================

check_system() {
    log "Checking system compatibility..."

    # Check if running as root
    if [[ "$EUID" -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi

    # Check OS compatibility
    if [[ ! -f /etc/os-release ]]; then
        error "Cannot determine OS version"
    fi

    . /etc/os-release
    log "Detected OS: $NAME $VERSION"

    # Check supported OS
    case "$ID" in
        ubuntu|debian)
            PACKAGE_MANAGER="apt"
            ;;
        centos|rhel|fedora)
            PACKAGE_MANAGER="yum"
            if command -v dnf &> /dev/null; then
                PACKAGE_MANAGER="dnf"
            fi
            ;;
        *)
            warning "OS not officially supported: $NAME"
            if ! confirm "Continue anyway?"; then
                exit 1
            fi
            PACKAGE_MANAGER="apt"  # Default assumption
            ;;
    esac

    success "System compatibility check passed"
}

# =============================================================================
# System Updates and Dependencies
# =============================================================================

update_system() {
    log "Updating system packages..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would update system packages"
        return 0
    fi

    case "$PACKAGE_MANAGER" in
        apt)
            apt update
            apt upgrade -y
            apt install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates
            ;;
        yum|dnf)
            $PACKAGE_MANAGER update -y
            $PACKAGE_MANAGER install -y curl wget gnupg2 ca-certificates
            ;;
    esac

    success "System packages updated"
}

install_dependencies() {
    log "Installing system dependencies..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would install system dependencies"
        return 0
    fi

    local packages="git unzip htop iotop nethogs vnstat jq bc sysstat logrotate cron fail2ban ufw"

    case "$PACKAGE_MANAGER" in
        apt)
            apt install -y $packages postgresql-client
            ;;
        yum|dnf)
            $PACKAGE_MANAGER install -y $packages postgresql
            ;;
    esac

    # Enable and start services
    systemctl enable sysstat
    systemctl start sysstat
    systemctl enable fail2ban
    systemctl start fail2ban
    systemctl enable cron
    systemctl start cron

    success "System dependencies installed"
}

# =============================================================================
# Node.js Installation
# =============================================================================

install_nodejs() {
    log "Installing Node.js version $NODE_VERSION..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would install Node.js $NODE_VERSION"
        return 0
    fi

    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    
    case "$PACKAGE_MANAGER" in
        apt)
            apt install -y nodejs
            ;;
        yum|dnf)
            $PACKAGE_MANAGER install -y nodejs npm
            ;;
    esac

    # Verify installation
    local node_version=$(node --version)
    local npm_version=$(npm --version)
    
    log "Installed Node.js: $node_version"
    log "Installed npm: $npm_version"

    # Install global packages
    npm install -g pm2

    success "Node.js installation completed"
}

# =============================================================================
# User and Directory Setup
# =============================================================================

setup_application_user() {
    log "Setting up application user: $APP_USER"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create user $APP_USER and directory $APP_DIR"
        return 0
    fi

    # Create application user
    if ! id "$APP_USER" &>/dev/null; then
        useradd --system --shell /bin/bash --home-dir "$APP_DIR" --create-home "$APP_USER"
        success "Created user: $APP_USER"
    else
        log "User $APP_USER already exists"
    fi

    # Create application directory structure
    mkdir -p "$APP_DIR"/{releases,shared,backups,logs,monitoring}
    mkdir -p "$APP_DIR/shared"/{logs,uploads,config}
    
    # Set ownership and permissions
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
    chmod 755 "$APP_DIR"
    chmod 750 "$APP_DIR"/{backups,logs,monitoring}
    chmod 700 "$APP_DIR/shared/config"

    success "Application user and directories configured"
}

# =============================================================================
# Nginx Installation and Configuration
# =============================================================================

install_nginx() {
    if [[ "$INSTALL_NGINX" != "true" ]]; then
        log "Skipping nginx installation"
        return 0
    fi

    log "Installing and configuring nginx..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would install and configure nginx"
        return 0
    fi

    case "$PACKAGE_MANAGER" in
        apt)
            apt install -y nginx
            ;;
        yum|dnf)
            $PACKAGE_MANAGER install -y nginx
            ;;
    esac

    # Enable and start nginx
    systemctl enable nginx
    systemctl start nginx

    # Create basic configuration
    cat > /etc/nginx/sites-available/default << EOF
# Temporary configuration - will be replaced by SSL setup
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    
    location / {
        return 301 https://\$host\$request_uri;
    }
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}
EOF

    # Create certbot directory
    mkdir -p /var/www/certbot
    chown -R www-data:www-data /var/www/certbot

    # Test nginx configuration
    if nginx -t; then
        systemctl reload nginx
        success "Nginx installed and configured"
    else
        error "Nginx configuration test failed"
    fi
}

# =============================================================================
# Firewall Configuration
# =============================================================================

setup_firewall() {
    if [[ "$SETUP_FIREWALL" != "true" ]]; then
        log "Skipping firewall setup"
        return 0
    fi

    log "Configuring UFW firewall..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would configure UFW firewall"
        return 0
    fi

    # Reset UFW to defaults
    ufw --force reset

    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing

    # Allow SSH (current connection)
    ufw allow ssh

    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp

    # Allow application ports (if not using nginx proxy)
    if [[ "$INSTALL_NGINX" != "true" ]]; then
        ufw allow 3000/tcp  # Application
        ufw allow 8081/tcp  # WebSocket
    fi

    # Enable firewall
    ufw --force enable

    success "Firewall configured"
}

# =============================================================================
# Security Hardening
# =============================================================================

apply_security_hardening() {
    log "Applying security hardening..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would apply security hardening"
        return 0
    fi

    # Configure fail2ban
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
ignoreip = 127.0.0.1/8

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

    systemctl restart fail2ban

    # Set secure SSH configuration
    if [[ -f /etc/ssh/sshd_config ]]; then
        # Backup original config
        cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
        
        # Apply secure settings
        sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
        sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
        sed -i 's/#X11Forwarding yes/X11Forwarding no/' /etc/ssh/sshd_config
        
        systemctl restart ssh || systemctl restart sshd
    fi

    # Set system limits
    cat > /etc/security/limits.d/boutique.conf << EOF
$APP_USER soft nofile 65536
$APP_USER hard nofile 65536
$APP_USER soft nproc 32768
$APP_USER hard nproc 32768
EOF

    # Configure log rotation
    cat > /etc/logrotate.d/boutique-client << EOF
$APP_DIR/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $APP_USER $APP_USER
    postrotate
        /bin/kill -USR1 \$(cat $APP_DIR/shared/pids/server.pid 2>/dev/null) 2>/dev/null || true
    endscript
}
EOF

    success "Security hardening applied"
}

# =============================================================================
# Service Configuration
# =============================================================================

create_systemd_service() {
    log "Creating systemd service..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create systemd service"
        return 0
    fi

    cat > /etc/systemd/system/boutique-client.service << EOF
[Unit]
Description=Boutique Client Portal
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=exec
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/current
ExecStart=/usr/bin/node build/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=boutique-client

# Environment
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIR/shared/config/.env.production

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR/logs $APP_DIR/shared
PrivateTmp=true

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable boutique-client

    success "Systemd service created"
}

# =============================================================================
# Environment Configuration
# =============================================================================

create_environment_template() {
    log "Creating production environment template..."

    local env_file="$APP_DIR/shared/config/.env.production"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create environment template at $env_file"
        return 0
    fi

    mkdir -p "$(dirname "$env_file")"
    
    cat > "$env_file" << EOF
# PRODUCTION ENVIRONMENT CONFIGURATION
# =============================================================================
# CRITICAL: This file contains production secrets and should NEVER be committed
# =============================================================================

# Environment
NODE_ENV=production
CHATBOT_MODE=production

# =============================================================================
# Database Configuration (UPDATE WITH YOUR PRODUCTION DATABASE)
# =============================================================================
DATABASE_URL="postgresql://username:password@localhost:5432/boutique_prod?sslmode=require&connect_timeout=30"

# Database connection details
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="boutique_prod"
DB_USER="boutique_user"
DB_PASSWORD="GENERATE_SECURE_PASSWORD"
DB_SSL_MODE="require"
DB_CONNECT_TIMEOUT="30"

# =============================================================================
# Application Configuration
# =============================================================================
PUBLIC_APP_NAME="Client Portal"
INSTANCE_ID="GENERATE_UNIQUE_ID"

# =============================================================================
# URLs (UPDATE WITH YOUR DOMAIN)
# =============================================================================
PUBLIC_APP_URL="https://$DOMAIN"
PUBLIC_WS_URL="wss://$DOMAIN"
AUTH_URL="https://$DOMAIN"
NEXTAUTH_URL="https://$DOMAIN"

# =============================================================================
# Port Configuration
# =============================================================================
PORT=3000
PUBLIC_WS_PORT=8081

# =============================================================================
# Authentication Secrets (GENERATE SECURE SECRETS)
# =============================================================================
AUTH_SECRET="GENERATE_32_BYTE_SECRET"
NEXTAUTH_SECRET="GENERATE_32_BYTE_SECRET"
SESSION_SECRET="GENERATE_32_BYTE_SECRET"

# =============================================================================
# Google OAuth Configuration (UPDATE WITH YOUR CREDENTIALS)
# =============================================================================
GOOGLE_CLIENT_ID="YOUR_PRODUCTION_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="YOUR_PRODUCTION_GOOGLE_CLIENT_SECRET"

# =============================================================================
# WebSocket Configuration
# =============================================================================
WS_AUTH_TOKEN="GENERATE_32_CHAR_TOKEN"
PUBLIC_CHATBOT_WEBSOCKET_HOST="$DOMAIN"
PUBLIC_CHATBOT_WEBSOCKET_PORT=8081

# =============================================================================
# Security Configuration
# =============================================================================
FORCE_HTTPS=true
ENABLE_SECURITY_HEADERS=true
ENABLE_RATE_LIMITING=true

# =============================================================================
# Monitoring Configuration (OPTIONAL)
# =============================================================================
ALERT_EMAIL="$EMAIL"
# SLACK_WEBHOOK=""
# SENTRY_DSN=""

# =============================================================================
# Prisma Configuration
# =============================================================================
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
EOF

    chown "$APP_USER:$APP_USER" "$env_file"
    chmod 600 "$env_file"

    success "Environment template created at $env_file"
}

# =============================================================================
# Final System Configuration
# =============================================================================

configure_cron_jobs() {
    log "Setting up system cron jobs..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would setup cron jobs"
        return 0
    fi

    # Create cron jobs for the application user
    sudo -u "$APP_USER" crontab -l 2>/dev/null > /tmp/boutique-cron || true
    
    # Remove existing boutique jobs
    grep -v "boutique-client" /tmp/boutique-cron > /tmp/boutique-cron-new || touch /tmp/boutique-cron-new
    
    # Add new cron jobs
    cat >> /tmp/boutique-cron-new << EOF

# Boutique Client Portal cron jobs
# Database backup every day at 2 AM
0 2 * * * $APP_DIR/current/scripts/database-backup.sh --quiet # boutique-client

# Log cleanup every week
0 1 * * 0 find $APP_DIR/logs -name "*.log" -mtime +30 -delete # boutique-client

# Health monitoring every 5 minutes
*/5 * * * * $APP_DIR/current/scripts/system-monitor.sh --quiet # boutique-client

EOF

    sudo -u "$APP_USER" crontab /tmp/boutique-cron-new
    rm -f /tmp/boutique-cron /tmp/boutique-cron-new

    success "Cron jobs configured"
}

# =============================================================================
# Validation and Testing
# =============================================================================

validate_setup() {
    log "Validating server setup..."

    local validation_errors=0

    # Check user
    if id "$APP_USER" &>/dev/null; then
        success "Application user exists: $APP_USER"
    else
        error "Application user missing: $APP_USER"
        ((validation_errors++))
    fi

    # Check directories
    if [[ -d "$APP_DIR" ]]; then
        success "Application directory exists: $APP_DIR"
    else
        error "Application directory missing: $APP_DIR"
        ((validation_errors++))
    fi

    # Check Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        success "Node.js installed: $node_version"
    else
        error "Node.js not found"
        ((validation_errors++))
    fi

    # Check PM2
    if command -v pm2 &> /dev/null; then
        success "PM2 installed"
    else
        error "PM2 not found"
        ((validation_errors++))
    fi

    # Check nginx (if installed)
    if [[ "$INSTALL_NGINX" == "true" ]]; then
        if systemctl is-active nginx &> /dev/null; then
            success "Nginx is running"
        else
            warning "Nginx is not running"
        fi
    fi

    # Check firewall (if configured)
    if [[ "$SETUP_FIREWALL" == "true" ]]; then
        if ufw status | grep -q "Status: active"; then
            success "UFW firewall is active"
        else
            warning "UFW firewall is not active"
        fi
    fi

    if [[ $validation_errors -gt 0 ]]; then
        error "Server setup validation failed with $validation_errors errors"
    else
        success "Server setup validation passed"
    fi
}

# =============================================================================
# Main Setup Flow
# =============================================================================

main() {
    log "Starting production server setup for Boutique Client Portal..."
    log "Domain: $DOMAIN"
    log "User: $APP_USER"
    log "Directory: $APP_DIR"
    log "Node.js: $NODE_VERSION"
    log "Nginx: $INSTALL_NGINX"
    log "Firewall: $SETUP_FIREWALL"

    if [[ "$DRY_RUN" == "true" ]]; then
        warning "DRY RUN MODE - No changes will be made"
    else
        echo
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}     PRODUCTION SERVER SETUP WARNING    ${NC}"
        echo -e "${RED}========================================${NC}"
        echo
        echo -e "${YELLOW}This script will make significant changes to this server.${NC}"
        echo -e "${YELLOW}Domain: $DOMAIN${NC}"
        echo -e "${YELLOW}User: $APP_USER${NC}"
        echo -e "${YELLOW}Directory: $APP_DIR${NC}"
        echo
        if ! confirm "Are you sure you want to continue?"; then
            log "Server setup cancelled by user"
            exit 0
        fi
    fi

    check_system
    update_system
    install_dependencies
    install_nodejs
    setup_application_user
    install_nginx
    setup_firewall
    apply_security_hardening
    create_systemd_service
    create_environment_template
    configure_cron_jobs
    validate_setup

    success "Production server setup completed successfully!"
    
    echo
    echo "=== Server Setup Summary ==="
    echo "🌐 Domain: $DOMAIN"
    echo "👤 Application User: $APP_USER"
    echo "📁 Application Directory: $APP_DIR"
    echo "🟢 Node.js: $(node --version 2>/dev/null || echo 'Not found')"
    echo "🔧 PM2: $(pm2 --version 2>/dev/null || echo 'Not found')"
    echo "🌐 Nginx: ${INSTALL_NGINX:+"Installed"}${INSTALL_NGINX:-"Skipped"}"
    echo "🔥 Firewall: ${SETUP_FIREWALL:+"Configured"}${SETUP_FIREWALL:-"Skipped"}"
    echo
    echo "=== Next Steps ==="
    echo "1. Update environment file: $APP_DIR/shared/config/.env.production"
    echo "2. Generate secure secrets: ./scripts/generate-secrets.js"
    echo "3. Deploy application: ./scripts/deploy-production.sh"
    echo "4. Setup SSL: ./scripts/setup-ssl.sh --domain=$DOMAIN"
    echo "5. Setup monitoring: ./scripts/setup-monitoring.sh"
    echo
    echo "=== Important Files ==="
    echo "📝 Environment: $APP_DIR/shared/config/.env.production"
    echo "🔧 Service: /etc/systemd/system/boutique-client.service"
    echo "🌐 Nginx: /etc/nginx/sites-available/ (after SSL setup)"
    echo "🔥 Firewall: ufw status"
    echo "📋 Logs: $APP_DIR/logs/"
    echo
}

# =============================================================================
# Script Execution
# =============================================================================

# Trap errors
trap 'error "Server setup failed at line $LINENO"' ERR

# Parse arguments and run main function
parse_args "$@"
main