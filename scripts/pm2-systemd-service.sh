#!/usr/bin/env bash

# PM2 Systemd Service Setup Script for NixOS
# This script configures PM2 to run as a systemd service for the boutique-client user

set -e

# Configuration
SERVICE_USER="${SERVICE_USER:-boutique-client}"
APP_DIR="/opt/boutique-client"
SERVICE_NAME="pm2-$SERVICE_USER"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    warning "PM2 not found, installing via npm..."
    npm install -g pm2
fi

# Check if service user exists
if ! id "$SERVICE_USER" &>/dev/null; then
    error "User '$SERVICE_USER' does not exist. Please create the user first."
fi

log "Setting up PM2 systemd service for user: $SERVICE_USER"

# Create PM2 systemd service file for NixOS
info "Creating systemd service file..."
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=PM2 process manager for $SERVICE_USER
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=$SERVICE_USER
Group=users
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
TimeoutStartSec=60
Environment=PATH=/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/home/$SERVICE_USER/.nix-profile/bin
Environment=PM2_HOME=/home/$SERVICE_USER/.pm2
Environment=NODE_ENV=production

# PM2 runtime directory
WorkingDirectory=$APP_DIR/app

# Start PM2 as the service user
ExecStart=/run/current-system/sw/bin/pm2 resurrect
ExecReload=/run/current-system/sw/bin/pm2 reload all
ExecStop=/run/current-system/sw/bin/pm2 kill

# Restart configuration
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$APP_DIR /home/$SERVICE_USER/.pm2 /tmp

# Logging
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=pm2-$SERVICE_USER

[Install]
WantedBy=multi-user.target
EOF

# Set correct permissions
chmod 644 /etc/systemd/system/$SERVICE_NAME.service

# Initialize PM2 for the service user
info "Initializing PM2 for user $SERVICE_USER..."
sudo -u $SERVICE_USER bash -c "cd $APP_DIR && PM2_HOME=/home/$SERVICE_USER/.pm2 pm2 startup systemd -u $SERVICE_USER --hp /home/$SERVICE_USER"

# Create PM2 log directory
info "Setting up PM2 logging..."
sudo -u $SERVICE_USER mkdir -p /home/$SERVICE_USER/.pm2/logs
sudo -u $SERVICE_USER mkdir -p $APP_DIR/logs

# Generate PM2 startup script
info "Generating PM2 startup configuration..."
PM2_STARTUP_CMD=$(sudo -u $SERVICE_USER PM2_HOME=/home/$SERVICE_USER/.pm2 pm2 startup systemd -u $SERVICE_USER --hp /home/$SERVICE_USER | grep 'sudo')
if [ -n "$PM2_STARTUP_CMD" ]; then
    eval $PM2_STARTUP_CMD
fi

# Reload systemd daemon
info "Reloading systemd daemon..."
systemctl daemon-reload

# Enable the service
info "Enabling PM2 service..."
systemctl enable $SERVICE_NAME

log "✅ PM2 systemd service setup completed successfully!"

# Display service information
echo ""
echo "=== PM2 Service Information ==="
echo "Service Name: $SERVICE_NAME"
echo "Service User: $SERVICE_USER"
echo "Working Directory: $APP_DIR/app"
echo "PM2 Home: /home/$SERVICE_USER/.pm2"
echo ""
echo "=== Common Commands ==="
echo "Start service:    sudo systemctl start $SERVICE_NAME"
echo "Stop service:     sudo systemctl stop $SERVICE_NAME"
echo "Restart service:  sudo systemctl restart $SERVICE_NAME"
echo "Service status:   sudo systemctl status $SERVICE_NAME"
echo "View logs:        sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "=== PM2 Commands (as $SERVICE_USER) ==="
echo "PM2 status:       sudo -u $SERVICE_USER pm2 status"
echo "PM2 logs:         sudo -u $SERVICE_USER pm2 logs"
echo "PM2 restart:      sudo -u $SERVICE_USER pm2 restart all"
echo "PM2 save:         sudo -u $SERVICE_USER pm2 save"
echo ""

# Test the service
info "Testing PM2 service..."
if systemctl is-active --quiet $SERVICE_NAME; then
    log "✅ PM2 service is running"
else
    warning "PM2 service is not running. You may need to start your applications first."
    echo "To start your applications:"
    echo "1. sudo -u $SERVICE_USER pm2 start $APP_DIR/app/ecosystem.config.js --env production"
    echo "2. sudo -u $SERVICE_USER pm2 save"
    echo "3. sudo systemctl start $SERVICE_NAME"
fi