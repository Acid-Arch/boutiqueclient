#!/bin/bash

# Complete Production Installation Script for Boutique Client Portal
# Sets up all infrastructure components for production deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}===================================================${NC}"
    echo -e "${BLUE} $1 ${NC}"
    echo -e "${BLUE}===================================================${NC}"
    echo ""
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        print_info "Usage: sudo ./scripts/install-production.sh"
        exit 1
    fi
}

# Get user inputs
get_user_inputs() {
    print_header "Production Configuration"
    
    read -p "Enter your domain name (e.g., portal.yourdomain.com): " DOMAIN
    read -p "Enter your email for SSL certificates: " EMAIL
    read -p "Enter deployment user (default: george): " DEPLOY_USER
    DEPLOY_USER=${DEPLOY_USER:-george}
    
    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        print_error "Domain and email are required"
        exit 1
    fi
    
    print_status "Configuration:"
    print_status "  Domain: $DOMAIN"
    print_status "  Email: $EMAIL"
    print_status "  Deploy User: $DEPLOY_USER"
    
    read -p "Continue with installation? (y/N): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled"
        exit 0
    fi
}

# Install system dependencies
install_dependencies() {
    print_header "Installing System Dependencies"
    
    print_status "Updating package lists..."
    apt-get update
    
    print_status "Installing required packages..."
    apt-get install -y \
        curl \
        wget \
        gnupg \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        lsb-release \
        nginx \
        postgresql-client \
        logrotate \
        cron \
        bc \
        jq \
        sendmail \
        certbot \
        python3-certbot-nginx
    
    print_status "System dependencies installed"
}

# Install Node.js and PM2
install_nodejs() {
    print_header "Installing Node.js and PM2"
    
    # Install Node.js 18.x
    if ! command -v node >/dev/null 2>&1; then
        print_status "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    else
        print_status "Node.js is already installed: $(node --version)"
    fi
    
    # Install PM2 globally
    if ! command -v pm2 >/dev/null 2>&1; then
        print_status "Installing PM2..."
        npm install -g pm2
        
        # Enable PM2 startup script
        sudo -u $DEPLOY_USER pm2 startup systemd -u $DEPLOY_USER --hp /home/$DEPLOY_USER
    else
        print_status "PM2 is already installed: $(pm2 --version)"
    fi
    
    print_status "Node.js and PM2 setup completed"
}

# Setup Nginx
setup_nginx() {
    print_header "Setting up Nginx"
    
    # Copy nginx configuration
    print_status "Copying Nginx configuration..."
    cp "$SCRIPT_DIR/../nginx/boutique-portal.conf" /etc/nginx/sites-available/boutique-portal
    
    # Replace domain placeholder
    sed -i "s/your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/boutique-portal
    
    # Enable site
    ln -sf /etc/nginx/sites-available/boutique-portal /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    if nginx -t; then
        print_status "Nginx configuration test passed"
    else
        print_error "Nginx configuration test failed"
        exit 1
    fi
    
    # Create SSL directory for certbot
    mkdir -p /var/www/certbot
    chown -R www-data:www-data /var/www/certbot
    
    print_status "Nginx setup completed"
}

# Setup SSL certificates
setup_ssl() {
    print_header "Setting up SSL Certificates"
    
    # Stop nginx temporarily
    systemctl stop nginx 2>/dev/null || true
    
    print_status "Obtaining SSL certificate for $DOMAIN..."
    certbot certonly \
        --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$DOMAIN" \
        --non-interactive
    
    if [ $? -eq 0 ]; then
        print_status "SSL certificate obtained successfully"
        
        # Setup automatic renewal
        echo "0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx" | crontab -
        print_status "SSL renewal cron job installed"
    else
        print_error "Failed to obtain SSL certificate"
        exit 1
    fi
}

# Setup systemd service
setup_systemd() {
    print_header "Setting up Systemd Service"
    
    # Copy and configure systemd service
    cp "$SCRIPT_DIR/boutique-portal.service" /etc/systemd/system/
    
    # Update service file with correct user and paths
    sed -i "s|User=george|User=$DEPLOY_USER|g" /etc/systemd/system/boutique-portal.service
    sed -i "s|Group=george|Group=$DEPLOY_USER|g" /etc/systemd/system/boutique-portal.service
    sed -i "s|/home/george/dev/boutiqueclient|$PROJECT_ROOT|g" /etc/systemd/system/boutique-portal.service
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable boutique-portal
    
    print_status "Systemd service configured and enabled"
}

# Setup log rotation
setup_logging() {
    print_header "Setting up Log Rotation"
    
    # Copy logrotate configuration
    cp "$SCRIPT_DIR/logrotate.conf" /etc/logrotate.d/boutique-portal
    
    # Update paths in logrotate config
    sed -i "s|/home/george/dev/boutiqueclient|$PROJECT_ROOT|g" /etc/logrotate.d/boutique-portal
    sed -i "s|george george|$DEPLOY_USER $DEPLOY_USER|g" /etc/logrotate.d/boutique-portal
    
    # Test logrotate configuration
    logrotate -d /etc/logrotate.d/boutique-portal >/dev/null 2>&1
    
    print_status "Log rotation configured"
}

# Setup monitoring
setup_monitoring() {
    print_header "Setting up System Monitoring"
    
    # Make monitor script executable
    chmod +x "$SCRIPT_DIR/system-monitor.sh"
    
    # Create monitoring cron job (every 5 minutes)
    echo "*/5 * * * * $DEPLOY_USER $SCRIPT_DIR/system-monitor.sh >/dev/null 2>&1" >> /etc/crontab
    
    # Create daily summary report (at 6 AM)
    echo "0 6 * * * $DEPLOY_USER $SCRIPT_DIR/system-monitor.sh --summary >> /var/log/boutique-monitor-daily.log" >> /etc/crontab
    
    print_status "System monitoring configured"
}

# Setup backup automation
setup_backups() {
    print_header "Setting up Automated Backups"
    
    # Make backup script executable
    chmod +x "$SCRIPT_DIR/database-backup.sh"
    
    # Create backup directories
    sudo -u $DEPLOY_USER mkdir -p "$PROJECT_ROOT/backups/database"
    sudo -u $DEPLOY_USER mkdir -p "$PROJECT_ROOT/logs"
    
    # Create daily backup cron job (at 2 AM)
    echo "0 2 * * * $DEPLOY_USER $SCRIPT_DIR/database-backup.sh --verify >> $PROJECT_ROOT/logs/backup-cron.log 2>&1" >> /etc/crontab
    
    # Create weekly backup with cloud upload (Sundays at 3 AM)
    echo "0 3 * * 0 $DEPLOY_USER $SCRIPT_DIR/database-backup.sh --verify --upload >> $PROJECT_ROOT/logs/backup-cron.log 2>&1" >> /etc/crontab
    
    print_status "Automated backups configured"
}

# Create production environment
setup_production_env() {
    print_header "Setting up Production Environment"
    
    # Create production environment file from template
    if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
        print_warning ".env.production not found, please create it first"
        return 1
    fi
    
    # Update domain in production env
    sudo -u $DEPLOY_USER sed -i "s|your-production-domain.com|$DOMAIN|g" "$PROJECT_ROOT/.env.production"
    sudo -u $DEPLOY_USER sed -i "s|your-domain.com|$DOMAIN|g" "$PROJECT_ROOT/.env.production"
    
    # Ensure proper permissions
    chown $DEPLOY_USER:$DEPLOY_USER "$PROJECT_ROOT/.env.production"
    chmod 600 "$PROJECT_ROOT/.env.production"
    
    print_status "Production environment configured"
}

# Install application dependencies
install_app_dependencies() {
    print_header "Installing Application Dependencies"
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies as deploy user
    sudo -u $DEPLOY_USER npm install --production
    
    # Generate Prisma client
    sudo -u $DEPLOY_USER npx prisma generate
    
    # Build application
    sudo -u $DEPLOY_USER npm run build
    
    print_status "Application dependencies installed and built"
}

# Start services
start_services() {
    print_header "Starting Services"
    
    # Start and enable nginx
    systemctl start nginx
    systemctl enable nginx
    print_status "Nginx started and enabled"
    
    # Start application via systemd
    systemctl start boutique-portal
    print_status "Boutique Portal service started"
    
    # Check service status
    sleep 5
    if systemctl is-active --quiet boutique-portal; then
        print_status "✅ Boutique Portal is running"
    else
        print_error "❌ Boutique Portal failed to start"
        systemctl status boutique-portal --no-pager
        return 1
    fi
    
    # Test application health
    print_status "Testing application health..."
    sleep 10
    if curl -f -s "https://$DOMAIN/api/admin/health" >/dev/null; then
        print_status "✅ Application health check passed"
    else
        print_warning "⚠️ Application health check failed (this is normal on first start)"
    fi
}

# Final setup and verification
final_setup() {
    print_header "Final Setup and Verification"
    
    # Restart cron to load new jobs
    systemctl restart cron
    print_status "Cron service restarted with new jobs"
    
    # Create summary
    print_status "Installation Summary:"
    print_status "  🌐 Domain: https://$DOMAIN"
    print_status "  📊 Health Check: https://$DOMAIN/api/admin/health"
    print_status "  👤 Deploy User: $DEPLOY_USER"
    print_status "  📁 Project Root: $PROJECT_ROOT"
    print_status "  🔧 PM2 Status: $(pm2 list | grep -c online || echo 0) processes online"
    print_status "  🔒 SSL Certificate: $(ls /etc/letsencrypt/live/$DOMAIN/ 2>/dev/null | wc -l) files"
    
    echo ""
    echo -e "${GREEN}✅ Production Installation Complete!${NC}"
    echo ""
    echo -e "${BLUE}Management Commands:${NC}"
    echo "  systemctl status boutique-portal    # Check service status"
    echo "  systemctl restart boutique-portal   # Restart application"
    echo "  pm2 status                          # Check PM2 processes"
    echo "  pm2 logs boutique-client-portal     # View application logs"
    echo "  nginx -t && systemctl reload nginx  # Reload Nginx config"
    echo ""
    echo -e "${BLUE}Monitoring:${NC}"
    echo "  $SCRIPT_DIR/system-monitor.sh       # Run health checks"
    echo "  tail -f $PROJECT_ROOT/logs/combined.log  # View live logs"
    echo "  journalctl -u boutique-portal -f    # View service logs"
    echo ""
    echo -e "${BLUE}Backups:${NC}"
    echo "  $SCRIPT_DIR/database-backup.sh      # Manual backup"
    echo "  ls -la $PROJECT_ROOT/backups/database/  # View backups"
    echo ""
}

# Main installation process
main() {
    print_header "Boutique Portal Production Installation"
    
    check_root
    get_user_inputs
    install_dependencies
    install_nodejs
    setup_nginx
    setup_ssl
    setup_systemd
    setup_logging
    setup_monitoring
    setup_backups
    setup_production_env
    install_app_dependencies
    start_services
    final_setup
    
    print_status "🎉 Installation completed successfully!"
    print_status "Your application should be available at: https://$DOMAIN"
}

# Error handling
trap 'print_error "Installation failed at line $LINENO"' ERR

# Run main function
main "$@"