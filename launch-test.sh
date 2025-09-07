#!/run/current-system/sw/bin/bash

# =============================================================================
# Client Portal Launch Script for Testing
# =============================================================================
# This script sets up and launches the complete client portal environment
# for testing purposes, including all required services and dependencies.
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/george/dev/boutiqueclient"
DEV_PORT=5874
WS_PORT=8743
TEST_MODE=${1:-"full"}  # Options: full, dev-only, ws-only

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo -e "${CYAN}"
    echo "============================================================================="
    echo "  CLIENT PORTAL - TEST LAUNCH SCRIPT"
    echo "============================================================================="
    echo -e "${NC}"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "$service port $port is already in use"
        return 1
    else
        return 0
    fi
}

kill_existing_services() {
    print_step "Stopping any existing services..."
    
    # Kill processes on our ports
    for port in $DEV_PORT $WS_PORT; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "Killing process on port $port"
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
    done
    
    # Kill any node/npm processes related to our project
    pkill -f "vite.*$DEV_PORT" 2>/dev/null || true
    pkill -f "websocket.*$WS_PORT" 2>/dev/null || true
    
    sleep 2
    print_success "Cleaned up existing services"
}

check_dependencies() {
    print_step "Checking dependencies..."
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
        print_error "package.json not found in $PROJECT_DIR"
        exit 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        print_warning "node_modules not found, running npm install..."
        npm install
    fi
    
    # Check environment file
    if [[ ! -f ".env" ]]; then
        print_warning ".env file not found, copying from .env.example..."
        if [[ -f ".env.example" ]]; then
            cp .env.example .env
            print_warning "Please configure your .env file with actual values before running again"
            echo -e "${YELLOW}Required environment variables:${NC}"
            echo "  - DATABASE_URL (PostgreSQL connection)"
            echo "  - AUTH_SECRET (32+ character string)"  
            echo "  - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (for OAuth)"
            exit 1
        else
            print_error ".env.example not found"
            exit 1
        fi
    fi
    
    # Check database connection
    print_step "Checking database connection..."
    if ! PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma db pull --preview-feature >/dev/null 2>&1; then
        print_warning "Database connection issue or schema not yet applied"
        print_step "Generating Prisma client..."
        PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate
        
        print_step "Applying database migrations..."
        PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy 2>/dev/null || PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma db push
    fi
    
    print_success "Dependencies checked"
}

run_type_check() {
    print_step "Running type check..."
    if npm run check; then
        print_success "Type check passed"
    else
        print_error "Type check failed"
        exit 1
    fi
}

launch_full_environment() {
    print_step "Launching full environment (WebSocket + Development server)..."
    
    # Export required environment variables
    export PORT=$DEV_PORT
    export PUBLIC_WS_PORT=$WS_PORT
    
    print_step "Starting services..."
    echo -e "${CYAN}Access URLs:${NC}"
    echo "  🌐 Web App: http://localhost:$DEV_PORT"
    echo "  🔌 WebSocket: ws://localhost:$WS_PORT"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo ""
    
    # Use the npm script that starts both services
    npm run dev:full
}

launch_dev_only() {
    print_step "Launching development server only..."
    
    export PORT=$DEV_PORT
    
    echo -e "${CYAN}Access URL:${NC}"
    echo "  🌐 Web App: http://localhost:$DEV_PORT"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
    echo ""
    
    npm run dev
}

launch_websocket_only() {
    print_step "Launching WebSocket server only..."
    
    export PUBLIC_WS_PORT=$WS_PORT
    
    echo -e "${CYAN}WebSocket URL:${NC}"
    echo "  🔌 WebSocket: ws://localhost:$WS_PORT"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop the WebSocket server${NC}"
    echo ""
    
    npm run ws:dev
}

show_usage() {
    echo -e "${CYAN}Usage:${NC}"
    echo "  $0 [mode]"
    echo ""
    echo -e "${CYAN}Modes:${NC}"
    echo "  full     - Launch WebSocket + Development server (default)"
    echo "  dev      - Launch Development server only"
    echo "  ws       - Launch WebSocket server only"
    echo "  check    - Run dependency and type checks only"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  $0                # Full environment"
    echo "  $0 full          # Full environment"
    echo "  $0 dev           # Development server only"
    echo "  $0 ws            # WebSocket server only"
    echo "  $0 check         # Check setup without launching"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    print_header
    
    # Handle help flag
    if [[ "$1" == "-h" || "$1" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # Change to project directory
    cd "$PROJECT_DIR"
    
    # Always run basic checks
    check_dependencies
    
    # Handle different modes
    case "$TEST_MODE" in
        "full")
            kill_existing_services
            run_type_check
            launch_full_environment
            ;;
        "dev")
            kill_existing_services
            run_type_check
            launch_dev_only
            ;;
        "ws")
            kill_existing_services
            launch_websocket_only
            ;;
        "check")
            run_type_check
            print_success "All checks passed! Ready to launch."
            ;;
        *)
            print_error "Unknown mode: $TEST_MODE"
            show_usage
            exit 1
            ;;
    esac
}

# Trap Ctrl+C and cleanup
trap 'echo -e "\n${YELLOW}Shutting down services...${NC}"; kill_existing_services; exit 0' INT

# Run main function
main "$@"