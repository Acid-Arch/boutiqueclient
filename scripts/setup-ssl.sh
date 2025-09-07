#!/bin/bash

# SSL Certificate Setup Script for Boutique Portal
# Sets up Let's Encrypt SSL certificates with automatic renewal

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
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

echo "🔒 Setting up SSL Certificates for Boutique Portal"
echo "================================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root (use sudo)"
    exit 1
fi

# Get domain from user
read -p "Enter your domain name (e.g., boutique.yourdomain.com): " DOMAIN
read -p "Enter your email for Let's Encrypt notifications: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    print_error "Domain and email are required"
    exit 1
fi

print_status "Setting up SSL for domain: $DOMAIN"
print_status "Email: $EMAIL"

# Step 1: Install certbot
print_status "Step 1/6: Installing Certbot..."
if command -v certbot >/dev/null 2>&1; then
    print_info "Certbot is already installed"
else
    # Detect OS and install certbot
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
        # RHEL/CentOS/Fedora
        if command -v dnf >/dev/null 2>&1; then
            dnf install -y certbot python3-certbot-nginx
        else
            yum install -y certbot python3-certbot-nginx
        fi
    else
        print_error "Unsupported operating system. Please install certbot manually."
        exit 1
    fi
fi

# Step 2: Stop nginx if running
print_status "Step 2/6: Managing Nginx service..."
if systemctl is-active --quiet nginx; then
    print_info "Stopping Nginx temporarily..."
    systemctl stop nginx
    NGINX_WAS_RUNNING=true
else
    NGINX_WAS_RUNNING=false
fi

# Step 3: Create certbot webroot directory
print_status "Step 3/6: Setting up certbot webroot..."
mkdir -p /var/www/certbot
chown -R www-data:www-data /var/www/certbot

# Step 4: Obtain SSL certificate
print_status "Step 4/6: Obtaining SSL certificate..."
certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --domains "$DOMAIN" \
    --non-interactive

if [ $? -ne 0 ]; then
    print_error "Failed to obtain SSL certificate"
    exit 1
fi

print_status "SSL certificate obtained successfully!"

# Step 5: Update Nginx configuration
print_status "Step 5/6: Updating Nginx configuration..."

# Replace domain placeholder in nginx config
NGINX_CONFIG="/home/george/dev/boutiqueclient/nginx/boutique-portal.conf"
NGINX_SITE="/etc/nginx/sites-available/boutique-portal"

if [ -f "$NGINX_CONFIG" ]; then
    # Copy and update the configuration
    cp "$NGINX_CONFIG" "$NGINX_SITE"
    sed -i "s/your-domain.com/$DOMAIN/g" "$NGINX_SITE"
    
    # Create sites-enabled symlink
    ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/boutique-portal
    
    # Remove default site if it exists
    if [ -f /etc/nginx/sites-enabled/default ]; then
        rm /etc/nginx/sites-enabled/default
        print_info "Removed default Nginx site"
    fi
    
    print_status "Nginx configuration updated for domain: $DOMAIN"
else
    print_warning "Nginx configuration template not found at $NGINX_CONFIG"
    print_info "You'll need to manually configure Nginx"
fi

# Step 6: Test and start Nginx
print_status "Step 6/6: Testing and starting Nginx..."

# Test nginx configuration
if nginx -t; then
    print_status "Nginx configuration test passed"
    
    # Start/restart nginx
    if [ "$NGINX_WAS_RUNNING" = true ]; then
        systemctl restart nginx
        print_status "Nginx restarted"
    else
        systemctl start nginx
        print_status "Nginx started"
    fi
    
    # Enable nginx to start on boot
    systemctl enable nginx
    print_status "Nginx enabled for startup"
else
    print_error "Nginx configuration test failed"
    print_error "Please check the configuration manually"
    exit 1
fi

# Setup automatic renewal
print_status "Setting up automatic SSL renewal..."

# Create renewal cron job
CRON_JOB="0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx"
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

# Test renewal
print_status "Testing SSL renewal process..."
certbot renew --dry-run

if [ $? -eq 0 ]; then
    print_status "SSL renewal test passed"
else
    print_warning "SSL renewal test failed - check configuration"
fi

echo ""
echo "✅ SSL Setup Complete!"
echo ""
echo "🔒 SSL Certificate Details:"
echo "  Domain: $DOMAIN"
echo "  Certificate: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "  Private Key: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo ""
echo "🔄 Automatic Renewal:"
echo "  Certificates will auto-renew via cron job"
echo "  Check status: sudo certbot certificates"
echo ""
echo "🌐 Your site should now be available at:"
echo "  https://$DOMAIN"
echo ""
echo "🔍 Next Steps:"
echo "  1. Update your .env.production file with the new domain"
echo "  2. Update DNS records to point to this server"
echo "  3. Test the application: https://$DOMAIN/api/admin/health"
echo ""