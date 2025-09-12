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