#!/bin/bash

# =============================================================================
# Production Management Script for Boutique Client Portal
# =============================================================================
#
# This script provides management commands for production environments
# Supports systemd and PM2 process management strategies
#
# Usage:
#   ./manage-production.sh <command> [options]
#
# Commands:
#   start              Start the application
#   stop               Stop the application
#   restart            Restart the application
#   status             Show application status
#   logs               Show application logs
#   health             Run health check
#   backup             Create database backup
#   restore <file>     Restore from backup
#   update             Update application (git pull + restart)
#   scale <instances>  Scale application (PM2 only)
#   monitor            Show real-time monitoring
#   config             Show current configuration
#
# Options:
#   --strategy=<systemd|pm2>  Process management strategy
#   --follow                  Follow logs in real-time
#   --lines=<number>          Number of log lines to show
#   --host=<hostname>         Target server (for remote management)
#   --user=<username>         SSH username (for remote management)
#
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default configuration
DEFAULT_STRATEGY="systemd"
DEFAULT_SERVICE_NAME="boutique-client"
DEFAULT_APP_DIR="/opt/boutique-client"
DEFAULT_LOG_LINES=50

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# =============================================================================
# Argument Parsing
# =============================================================================

parse_args() {
    COMMAND=""
    STRATEGY="$DEFAULT_STRATEGY"
    SERVICE_NAME="$DEFAULT_SERVICE_NAME"
    APP_DIR="$DEFAULT_APP_DIR"
    LOG_LINES="$DEFAULT_LOG_LINES"
    FOLLOW_LOGS=false
    HOST=""
    USER=""
    BACKUP_FILE=""
    SCALE_INSTANCES=""

    # First argument is command
    if [[ $# -gt 0 ]]; then
        COMMAND="$1"
        shift
    else
        show_help
        exit 1
    fi

    # Parse remaining arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --strategy=*)
                STRATEGY="${1#*=}"
                shift
                ;;
            --service-name=*)
                SERVICE_NAME="${1#*=}"
                shift
                ;;
            --app-dir=*)
                APP_DIR="${1#*=}"
                shift
                ;;
            --lines=*)
                LOG_LINES="${1#*=}"
                shift
                ;;
            --follow)
                FOLLOW_LOGS=true
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
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                # Handle positional arguments for specific commands
                case $COMMAND in
                    restore)
                        BACKUP_FILE="$1"
                        ;;
                    scale)
                        SCALE_INSTANCES="$1"
                        ;;
                    *)
                        error "Unknown option: $1"
                        ;;
                esac
                shift
                ;;
        esac
    done

    # Validate strategy
    if [[ ! "$STRATEGY" =~ ^(systemd|pm2)$ ]]; then
        error "Invalid strategy. Use: systemd or pm2"
    fi

    # Validate specific command requirements
    case $COMMAND in
        restore)
            if [[ -z "$BACKUP_FILE" ]]; then
                error "Backup file is required for restore command"
            fi
            ;;
        scale)
            if [[ -z "$SCALE_INSTANCES" ]]; then
                error "Number of instances is required for scale command"
            fi
            if [[ "$STRATEGY" != "pm2" ]]; then
                error "Scale command is only available with PM2 strategy"
            fi
            ;;
    esac
}

show_help() {
    cat << EOF
Production Management Script for Boutique Client Portal

USAGE:
    $0 <command> [options]

COMMANDS:
    start              Start the application
    stop               Stop the application
    restart            Restart the application
    status             Show application status
    logs               Show application logs
    health             Run health check
    backup             Create database backup
    restore <file>     Restore from backup
    update             Update application (git pull + restart)
    scale <instances>  Scale application (PM2 only)
    monitor            Show real-time monitoring
    config             Show current configuration

OPTIONS:
    --strategy=<systemd|pm2>  Process management strategy (default: systemd)
    --service-name=<name>     Service name (default: boutique-client)
    --app-dir=<path>          Application directory (default: /opt/boutique-client)
    --lines=<number>          Number of log lines to show (default: 50)
    --follow                  Follow logs in real-time
    --host=<hostname>         Target server (for remote management)
    --user=<username>         SSH username (for remote management)
    -h, --help                Show this help

EXAMPLES:
    # Local management
    $0 status
    $0 logs --follow
    $0 restart --strategy=pm2

    # Remote management
    $0 status --host=prod.example.com --user=deploy
    $0 backup --host=prod.example.com --user=deploy

    # Scale with PM2
    $0 scale 4 --strategy=pm2
EOF
}

# =============================================================================
# Remote Execution Helper
# =============================================================================

execute_command() {
    local cmd="$1"
    
    if [[ -n "$HOST" && -n "$USER" ]]; then
        ssh "$USER@$HOST" "$cmd"
    else
        eval "$cmd"
    fi
}

# =============================================================================
# Service Management Functions
# =============================================================================

start_service() {
    log "Starting $SERVICE_NAME..."

    local cmd
    case $STRATEGY in
        systemd)
            cmd="sudo systemctl start $SERVICE_NAME"
            ;;
        pm2)
            cmd="cd $APP_DIR/current && pm2 start ecosystem.config.js"
            ;;
    esac

    if execute_command "$cmd"; then
        success "Service started successfully"
    else
        error "Failed to start service"
    fi
}

stop_service() {
    log "Stopping $SERVICE_NAME..."

    local cmd
    case $STRATEGY in
        systemd)
            cmd="sudo systemctl stop $SERVICE_NAME"
            ;;
        pm2)
            cmd="pm2 stop $SERVICE_NAME"
            ;;
    esac

    if execute_command "$cmd"; then
        success "Service stopped successfully"
    else
        error "Failed to stop service"
    fi
}

restart_service() {
    log "Restarting $SERVICE_NAME..."

    local cmd
    case $STRATEGY in
        systemd)
            cmd="sudo systemctl restart $SERVICE_NAME"
            ;;
        pm2)
            cmd="pm2 restart $SERVICE_NAME"
            ;;
    esac

    if execute_command "$cmd"; then
        success "Service restarted successfully"
    else
        error "Failed to restart service"
    fi
}

show_status() {
    log "Checking status of $SERVICE_NAME..."

    local cmd
    case $STRATEGY in
        systemd)
            cmd="sudo systemctl status $SERVICE_NAME --no-pager"
            ;;
        pm2)
            cmd="pm2 status $SERVICE_NAME"
            ;;
    esac

    execute_command "$cmd"
}

# =============================================================================
# Log Management
# =============================================================================

show_logs() {
    log "Showing logs for $SERVICE_NAME..."

    local cmd
    case $STRATEGY in
        systemd)
            if [[ "$FOLLOW_LOGS" == "true" ]]; then
                cmd="sudo journalctl -u $SERVICE_NAME -f"
            else
                cmd="sudo journalctl -u $SERVICE_NAME --no-pager -n $LOG_LINES"
            fi
            ;;
        pm2)
            if [[ "$FOLLOW_LOGS" == "true" ]]; then
                cmd="pm2 logs $SERVICE_NAME --follow"
            else
                cmd="pm2 logs $SERVICE_NAME --lines $LOG_LINES"
            fi
            ;;
    esac

    execute_command "$cmd"
}

# =============================================================================
# Health Check
# =============================================================================

health_check() {
    log "Running health check..."

    local cmd="curl -f -s http://localhost:3000/health"
    
    if execute_command "$cmd" >/dev/null 2>&1; then
        success "Health check passed"
        
        # Show detailed health info
        local health_info
        health_info=$(execute_command "$cmd" 2>/dev/null || echo "{}")
        echo "Health Info: $health_info"
    else
        error "Health check failed"
    fi
}

# =============================================================================
# Database Management
# =============================================================================

create_backup() {
    log "Creating database backup..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="backup_${timestamp}.sql"
    local backup_path="$APP_DIR/backups/$backup_file"

    local cmd="mkdir -p $APP_DIR/backups && cd $APP_DIR/current && ./scripts/database-backup.sh --output=$backup_path"

    if execute_command "$cmd"; then
        success "Backup created: $backup_path"
    else
        error "Backup failed"
    fi
}

restore_backup() {
    log "Restoring from backup: $BACKUP_FILE..."

    if [[ -n "$HOST" && -n "$USER" ]]; then
        # For remote restore, need to upload file first
        scp "$BACKUP_FILE" "$USER@$HOST:/tmp/"
        local remote_file="/tmp/$(basename "$BACKUP_FILE")"
        local cmd="cd $APP_DIR/current && ./scripts/database-restore.sh --file=$remote_file"
    else
        local cmd="cd $APP_DIR/current && ./scripts/database-restore.sh --file=$BACKUP_FILE"
    fi

    if execute_command "$cmd"; then
        success "Restore completed successfully"
    else
        error "Restore failed"
    fi
}

# =============================================================================
# Update Management
# =============================================================================

update_application() {
    log "Updating application..."

    local cmd="cd $APP_DIR/current && git pull origin main && npm ci --only=production"

    if execute_command "$cmd"; then
        log "Code updated, restarting service..."
        restart_service
        success "Application updated successfully"
    else
        error "Update failed"
    fi
}

# =============================================================================
# Scaling (PM2 only)
# =============================================================================

scale_application() {
    if [[ "$STRATEGY" != "pm2" ]]; then
        error "Scaling is only available with PM2 strategy"
    fi

    log "Scaling $SERVICE_NAME to $SCALE_INSTANCES instances..."

    local cmd="pm2 scale $SERVICE_NAME $SCALE_INSTANCES"

    if execute_command "$cmd"; then
        success "Application scaled to $SCALE_INSTANCES instances"
        show_status
    else
        error "Scaling failed"
    fi
}

# =============================================================================
# Monitoring
# =============================================================================

show_monitoring() {
    log "Starting real-time monitoring..."

    case $STRATEGY in
        systemd)
            echo "System monitoring:"
            echo "- Service status: sudo systemctl status $SERVICE_NAME"
            echo "- Live logs: sudo journalctl -u $SERVICE_NAME -f"
            echo "- System resources: htop"
            ;;
        pm2)
            execute_command "pm2 monit"
            ;;
    esac
}

# =============================================================================
# Configuration Display
# =============================================================================

show_config() {
    log "Current configuration:"
    echo "Strategy: $STRATEGY"
    echo "Service Name: $SERVICE_NAME"
    echo "App Directory: $APP_DIR"
    echo "Host: ${HOST:-localhost}"
    echo "User: ${USER:-current}"
    
    if [[ -z "$HOST" ]]; then
        echo ""
        echo "Environment variables (first 10):"
        if [[ -f "$APP_DIR/.env.production" ]]; then
            head -10 "$APP_DIR/.env.production" | grep -v "^#" | grep -v "^$"
        else
            echo "No .env.production file found"
        fi
    fi
}

# =============================================================================
# Command Router
# =============================================================================

route_command() {
    case $COMMAND in
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        health)
            health_check
            ;;
        backup)
            create_backup
            ;;
        restore)
            restore_backup
            ;;
        update)
            update_application
            ;;
        scale)
            scale_application
            ;;
        monitor)
            show_monitoring
            ;;
        config)
            show_config
            ;;
        *)
            error "Unknown command: $COMMAND"
            ;;
    esac
}

# =============================================================================
# Main Function
# =============================================================================

main() {
    log "Executing command: $COMMAND"
    log "Strategy: $STRATEGY"
    
    if [[ -n "$HOST" ]]; then
        log "Target: $USER@$HOST"
    fi

    route_command
}

# =============================================================================
# Script Execution
# =============================================================================

parse_args "$@"
main