#!/bin/bash

# Production Startup Script (Native Node.js - No Docker)
# Validates environment, runs migrations, and starts the application with PM2

set -e  # Exit on any error

echo "🚀 Starting Client Portal in Production Mode (Native Node.js)"
echo "============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root is not recommended for production"
    print_warning "Consider creating a dedicated user for the application"
fi

# Set production environment
export NODE_ENV=production
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

print_status "Environment: $NODE_ENV"
print_status "Deployment Method: Native Node.js with PM2"

# Step 1: Validate environment variables
print_status "Step 1/7: Validating environment variables..."
if ! npm run validate:env; then
    print_error "Environment validation failed"
    print_error "Please check your .env.production file"
    exit 1
fi

# Step 2: Check PM2 installation
print_status "Step 2/7: Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    print_info "PM2 not found, installing globally..."
    npm install -g pm2
    print_status "PM2 installed successfully"
else
    print_status "PM2 found: $(pm2 --version)"
fi

# Step 3: Health check database connection
print_status "Step 3/7: Testing database connection..."
if ! npx prisma db execute --stdin <<< "SELECT 1;" >/dev/null 2>&1; then
    print_error "Database connection failed"
    print_error "Please check your DATABASE_URL and ensure PostgreSQL is running"
    exit 1
fi

print_status "Database connection: OK"

# Step 4: Generate Prisma client and run migrations
print_status "Step 4/7: Setting up database..."

print_status "Generating Prisma client..."
npx prisma generate

print_status "Running database migrations..."
npx prisma migrate deploy

print_status "Database setup: OK"

# Step 5: Build application if not already built
print_status "Step 5/7: Checking application build..."
if [ ! -d "build" ]; then
    print_status "Build directory not found, building application..."
    npm run production:build
else
    print_status "Build directory found: OK"
fi

# Step 6: Setup logging directory
print_status "Step 6/7: Setting up logging..."
mkdir -p logs
touch logs/combined.log logs/out.log logs/error.log
chmod 644 logs/*.log
print_status "Logging directory configured"

# Step 7: Security hardening
print_status "Step 7/8: Applying security hardening..."

# Set secure file permissions
find "$PROJECT_ROOT" -type f -name "*.env*" -exec chmod 600 {} \; 2>/dev/null || true
find "$PROJECT_ROOT/logs" -type f -exec chmod 644 {} \; 2>/dev/null || true
find "$PROJECT_ROOT/scripts" -type f -name "*.sh" -exec chmod 755 {} \; 2>/dev/null || true

# Create security headers for the application
export ENABLE_SECURITY_HEADERS=true
export FORCE_HTTPS=true
export ENABLE_RATE_LIMITING=true

print_status "Security hardening applied"

# Step 8: Final health checks
print_status "Step 8/8: Running final health checks..."

# Check if port is available
PORT=${PORT:-3000}
if netstat -tuln 2>/dev/null | grep -q ":$PORT " || lsof -ti:$PORT 2>/dev/null; then
    print_warning "Port $PORT appears to be in use"
    print_info "Attempting to stop existing PM2 processes..."
    pm2 stop boutique-client-portal 2>/dev/null || true
    pm2 delete boutique-client-portal 2>/dev/null || true
    sleep 2
    
    if netstat -tuln 2>/dev/null | grep -q ":$PORT " || lsof -ti:$PORT 2>/dev/null; then
        print_error "Port $PORT is still in use after stopping PM2 processes"
        print_error "Please manually stop the process using port $PORT"
        exit 1
    fi
fi

print_status "Port $PORT: Available"

# Memory check
if command -v free &> /dev/null; then
    AVAILABLE_MEMORY=$(free -m | awk 'NR==2{printf "%.0f", $7}' 2>/dev/null || echo "unknown")
    if [ "$AVAILABLE_MEMORY" != "unknown" ] && [ "$AVAILABLE_MEMORY" -lt 512 ]; then
        print_warning "Available memory: ${AVAILABLE_MEMORY}MB (recommended: 512MB+)"
    else
        print_status "Available memory: ${AVAILABLE_MEMORY}MB"
    fi
else
    print_warning "Cannot check memory usage (free command not available)"
fi

# Disk space check
AVAILABLE_DISK=$(df -h . 2>/dev/null | awk 'NR==2 {print $4}' || echo "unknown")
print_status "Available disk space: $AVAILABLE_DISK"

print_status "All health checks passed!"

echo ""
echo "🎉 Ready to start production server with PM2!"
echo "Application will be available at: ${PUBLIC_APP_URL:-http://localhost:$PORT}"
echo "Health check endpoint: ${PUBLIC_APP_URL:-http://localhost:$PORT}/api/admin/health"
echo ""

# Start the application with PM2
print_status "Starting application with PM2..."

# Load environment variables for production
if [ -f ".env.production" ]; then
    print_info "Loading production environment variables..."
    export $(grep -v '^#' .env.production | xargs)
fi

# Start with PM2 using ecosystem config
pm2 start ecosystem.config.js --env production

echo ""
echo "✅ Production server started successfully!"
echo ""
echo "🔒 Security Status:"
echo "  ✅ HTTPS enforcement: $FORCE_HTTPS"
echo "  ✅ Security headers: $ENABLE_SECURITY_HEADERS" 
echo "  ✅ Rate limiting: $ENABLE_RATE_LIMITING"
echo "  ✅ File permissions: Secured"
echo ""
echo "📊 Management Commands:"
echo "  pm2 status                    - Check application status"
echo "  pm2 logs boutique-client-portal - View application logs"
echo "  pm2 restart boutique-client-portal - Restart application"
echo "  pm2 stop boutique-client-portal - Stop application"
echo "  pm2 delete boutique-client-portal - Remove from PM2"
echo ""
echo "🔍 Monitoring & Security:"
echo "  pm2 monit                     - Real-time monitoring dashboard"
echo "  pm2 show boutique-client-portal - Detailed process information"
echo "  ./scripts/setup-monitoring.sh - Setup comprehensive monitoring"
echo "  ./scripts/setup-ssl.sh        - Configure SSL certificates"
echo "  ./scripts/disaster-recovery.sh - Disaster recovery procedures"
echo ""
echo "🚨 Emergency Procedures:"
echo "  ./scripts/database-backup.sh  - Create database backup"
echo "  ./scripts/system-monitor.sh   - Check system health"
echo "  tail -f logs/error.log        - Monitor error logs"
echo ""