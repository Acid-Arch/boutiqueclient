#!/bin/bash

# Quick Deployment Script for Hetzner Server
# Simplified version for common operations

set -e

SERVER_IP="5.78.147.68"
SERVER_USER="boutique-client"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Quick deployment function
quick_deploy() {
    log "🚀 Starting quick deployment to $SERVER_IP..."
    
    # Build locally first
    log "Building application locally..."
    npm run build || error "Build failed"
    
    # Deploy to server
    log "Deploying to server..."
    ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
        cd /opt/boutique-client/app
        git pull origin main
        npm ci --production
        NODE_ENV=production npm run build
        pm2 restart all
    " || error "Deployment failed"
    
    # Test deployment
    log "Testing deployment..."
    sleep 3
    if curl -f -s "http://$SERVER_IP:3000/api/admin/health" > /dev/null; then
        log "✅ Deployment successful!"
        log "🌐 Access at: http://$SERVER_IP:3000"
    else
        error "❌ Health check failed"
    fi
}

# Quick status check
quick_status() {
    log "📊 Checking status..."
    
    ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
        echo '=== PM2 Status ==='
        pm2 status
        echo ''
        echo '=== Recent Logs ==='
        pm2 logs --lines 10
    "
    
    # Health check
    if curl -f -s "http://$SERVER_IP:3000/api/admin/health" > /dev/null; then
        log "✅ Server healthy"
    else
        warning "⚠️ Health check failed"
    fi
}

# Quick restart
quick_restart() {
    log "🔄 Restarting services..."
    
    ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
        pm2 restart all
    " && log "✅ Restart completed"
}

# Show usage
show_usage() {
    echo "Quick Deployment Script"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  deploy    - Quick deploy (build + deploy + test)"
    echo "  status    - Check status and recent logs"
    echo "  restart   - Restart PM2 processes"
    echo "  logs      - Show live logs"
    echo "  test      - Test endpoints"
    echo ""
    exit 1
}

# Main execution
case "${1:-}" in
    deploy)
        quick_deploy
        ;;
    status)
        quick_status
        ;;
    restart)
        quick_restart
        ;;
    logs)
        log "📋 Showing live logs (Ctrl+C to exit)..."
        ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "pm2 logs --lines 20"
        ;;
    test)
        log "🧪 Testing endpoints..."
        base_url="http://$SERVER_IP:3000"
        
        echo "Health: $(curl -f -s "$base_url/api/admin/health" && echo "✅ OK" || echo "❌ FAIL")"
        echo "Main page: $(curl -f -s "$base_url/" > /dev/null && echo "✅ OK" || echo "❌ FAIL")"
        echo "Login: $(curl -f -s "$base_url/login" > /dev/null && echo "✅ OK" || echo "❌ FAIL")"
        ;;
    *)
        show_usage
        ;;
esac