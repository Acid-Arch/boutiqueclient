#!/bin/bash

# =============================================================================
# Disaster Recovery Script for Boutique Client Portal
# =============================================================================
#
# This script handles disaster recovery scenarios including:
# - Database restoration from backups
# - Application state recovery
# - Service restart and validation
# - Emergency rollback procedures
#
# Usage:
#   ./disaster-recovery.sh [options]
#
# Options:
#   --scenario=<scenario>           Recovery scenario (db-restore, full-restore, rollback)
#   --backup-file=<path>            Backup file to restore from
#   --backup-date=<YYYY-MM-DD>      Restore from specific date backup
#   --rollback-to=<timestamp>       Rollback to specific deployment
#   --verify-only                   Only verify backup integrity
#   --force                         Skip confirmations (use with caution)
#   --dry-run                       Show what would be done
#
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="/opt/boutique-client/backups"
RECOVERY_LOG="/var/log/boutique-recovery.log"

# Default configuration
DEFAULT_SCENARIO="db-restore"
DEFAULT_VERIFY_ONLY=false
DEFAULT_FORCE=false
DEFAULT_DRY_RUN=false

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
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${BLUE}${message}${NC}"
    echo "$message" >> "$RECOVERY_LOG"
}

success() {
    local message="[SUCCESS] $1"
    echo -e "${GREEN}${message}${NC}"
    echo "$message" >> "$RECOVERY_LOG"
}

warning() {
    local message="[WARNING] $1"
    echo -e "${YELLOW}${message}${NC}"
    echo "$message" >> "$RECOVERY_LOG"
}

error() {
    local message="[ERROR] $1"
    echo -e "${RED}${message}${NC}"
    echo "$message" >> "$RECOVERY_LOG"
    exit 1
}

confirm() {
    if [[ "$FORCE" == "true" ]]; then
        return 0
    fi
    
    local prompt="$1"
    local response
    read -p "$(echo -e "${YELLOW}$prompt [y/N]:${NC} ")" response
    [[ "$response" =~ ^[Yy]$ ]]
}

# =============================================================================
# Configuration Parsing
# =============================================================================

parse_args() {
    SCENARIO="$DEFAULT_SCENARIO"
    BACKUP_FILE=""
    BACKUP_DATE=""
    ROLLBACK_TO=""
    VERIFY_ONLY="$DEFAULT_VERIFY_ONLY"
    FORCE="$DEFAULT_FORCE"
    DRY_RUN="$DEFAULT_DRY_RUN"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --scenario=*)
                SCENARIO="${1#*=}"
                shift
                ;;
            --backup-file=*)
                BACKUP_FILE="${1#*=}"
                shift
                ;;
            --backup-date=*)
                BACKUP_DATE="${1#*=}"
                shift
                ;;
            --rollback-to=*)
                ROLLBACK_TO="${1#*=}"
                shift
                ;;
            --verify-only)
                VERIFY_ONLY=true
                shift
                ;;
            --force)
                FORCE=true
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

    # Validate scenarios
    if [[ ! "$SCENARIO" =~ ^(db-restore|full-restore|rollback)$ ]]; then
        error "Invalid scenario. Use: db-restore, full-restore, or rollback"
    fi

    # Scenario-specific validation
    case "$SCENARIO" in
        db-restore|full-restore)
            if [[ -z "$BACKUP_FILE" && -z "$BACKUP_DATE" ]]; then
                error "Either --backup-file or --backup-date is required for $SCENARIO"
            fi
            ;;
        rollback)
            if [[ -z "$ROLLBACK_TO" ]]; then
                error "--rollback-to is required for rollback scenario"
            fi
            ;;
    esac
}

show_help() {
    cat << EOF
Disaster Recovery Script for Boutique Client Portal

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --scenario=<scenario>           Recovery scenario:
                                    - db-restore: Restore database only
                                    - full-restore: Full system restore
                                    - rollback: Rollback to previous deployment
    --backup-file=<path>            Specific backup file to restore from
    --backup-date=<YYYY-MM-DD>      Restore from backup of specific date
    --rollback-to=<timestamp>       Rollback to specific deployment timestamp
    --verify-only                   Only verify backup integrity
    --force                         Skip all confirmations (dangerous!)
    --dry-run                       Show what would be done without executing
    -h, --help                      Show this help

SCENARIOS:
    Database Restore:
        $0 --scenario=db-restore --backup-date=2024-01-15
        
    Full System Restore:
        $0 --scenario=full-restore --backup-file=/backups/full-backup.tar.gz
        
    Emergency Rollback:
        $0 --scenario=rollback --rollback-to=20240115_143022

EXAMPLES:
    # Restore database from yesterday's backup
    $0 --scenario=db-restore --backup-date=$(date -d yesterday +%Y-%m-%d)
    
    # Verify specific backup file
    $0 --backup-file=/backups/db-backup-20240115.sql.gz --verify-only
    
    # Emergency rollback (with confirmation)
    $0 --scenario=rollback --rollback-to=20240115_143022
EOF
}

# =============================================================================
# Pre-Recovery Checks
# =============================================================================

pre_recovery_checks() {
    log "Running pre-recovery checks..."

    # Check if running as appropriate user
    if [[ "$EUID" -eq 0 ]]; then
        warning "Running as root. Consider using a dedicated service account."
    fi

    # Check disk space
    local available_space=$(df /opt/boutique-client | tail -1 | awk '{print $4}')
    if [[ "$available_space" -lt 1048576 ]]; then  # Less than 1GB
        warning "Low disk space available: $(( available_space / 1024 ))MB"
        if ! confirm "Continue with low disk space?"; then
            exit 1
        fi
    fi

    # Check database connectivity (if not doing full restore)
    if [[ "$SCENARIO" == "db-restore" ]]; then
        if ! pg_isready -h localhost -p 5432 &> /dev/null; then
            error "Database is not accessible. Check if PostgreSQL is running."
        fi
    fi

    # Check backup directory exists
    if [[ ! -d "$BACKUP_DIR" ]]; then
        error "Backup directory not found: $BACKUP_DIR"
    fi

    # Create recovery log if it doesn't exist
    touch "$RECOVERY_LOG"

    success "Pre-recovery checks completed"
}

# =============================================================================
# Backup Selection and Verification
# =============================================================================

find_backup_file() {
    if [[ -n "$BACKUP_FILE" ]]; then
        if [[ ! -f "$BACKUP_FILE" ]]; then
            error "Specified backup file not found: $BACKUP_FILE"
        fi
        return 0
    fi

    if [[ -n "$BACKUP_DATE" ]]; then
        # Find backup for specific date
        local pattern="$BACKUP_DIR/database-backup-${BACKUP_DATE}*.sql.gz"
        BACKUP_FILE=$(ls $pattern 2>/dev/null | head -1)
        
        if [[ -z "$BACKUP_FILE" ]]; then
            error "No backup found for date: $BACKUP_DATE"
        fi
        
        log "Found backup file: $BACKUP_FILE"
        return 0
    fi

    error "No backup file specified or found"
}

verify_backup_integrity() {
    log "Verifying backup integrity..."

    if [[ "$BACKUP_FILE" =~ \.gz$ ]]; then
        # Test gzip integrity
        if ! gzip -t "$BACKUP_FILE"; then
            error "Backup file is corrupted or not a valid gzip file"
        fi
        
        # Test SQL content (basic check)
        if ! zcat "$BACKUP_FILE" | head -100 | grep -q "PostgreSQL database dump"; then
            error "Backup file does not appear to be a PostgreSQL dump"
        fi
    else
        # Uncompressed backup
        if ! head -100 "$BACKUP_FILE" | grep -q "PostgreSQL database dump"; then
            error "Backup file does not appear to be a PostgreSQL dump"
        fi
    fi

    # Check backup file size (should be reasonable)
    local file_size=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")
    if [[ "$file_size" -lt 1024 ]]; then
        error "Backup file is suspiciously small: ${file_size} bytes"
    fi

    success "Backup integrity verification passed"
}

# =============================================================================
# Database Recovery
# =============================================================================

restore_database() {
    log "Starting database restoration..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would restore database from $BACKUP_FILE"
        return 0
    fi

    # Create pre-restore backup
    local pre_restore_backup="$BACKUP_DIR/pre-restore-$(date +%Y%m%d_%H%M%S).sql.gz"
    log "Creating pre-restore backup: $pre_restore_backup"
    
    if ! pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" | gzip > "$pre_restore_backup"; then
        warning "Failed to create pre-restore backup. Continue anyway?"
        if ! confirm "Continue without pre-restore backup?"; then
            exit 1
        fi
    fi

    # Stop application services
    log "Stopping application services..."
    systemctl stop boutique-client || true
    pm2 stop all || true

    # Drop existing connections
    log "Terminating existing database connections..."
    psql -h localhost -U "$DB_USER" -d postgres -c "
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '$DB_NAME'
          AND pid <> pg_backend_pid();
    " || true

    # Restore database
    log "Restoring database from backup..."
    
    if [[ "$BACKUP_FILE" =~ \.gz$ ]]; then
        # Compressed backup
        if ! zcat "$BACKUP_FILE" | psql -h localhost -U "$DB_USER" -d "$DB_NAME"; then
            error "Database restoration failed"
        fi
    else
        # Uncompressed backup
        if ! psql -h localhost -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"; then
            error "Database restoration failed"
        fi
    fi

    # Regenerate Prisma client
    log "Regenerating Prisma client..."
    cd "$PROJECT_ROOT"
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate || warning "Prisma generation failed"

    # Start application services
    log "Starting application services..."
    systemctl start boutique-client || pm2 start ecosystem.config.js || true

    success "Database restoration completed"
}

# =============================================================================
# Full System Recovery
# =============================================================================

restore_full_system() {
    log "Starting full system restoration..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would restore full system from $BACKUP_FILE"
        return 0
    fi

    error "Full system restore not implemented yet. Use manual recovery procedures."
}

# =============================================================================
# Rollback Procedures
# =============================================================================

rollback_deployment() {
    log "Starting deployment rollback to: $ROLLBACK_TO"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would rollback to deployment $ROLLBACK_TO"
        return 0
    fi

    local releases_dir="$PROJECT_ROOT/releases"
    local target_release="$releases_dir/$ROLLBACK_TO"
    
    if [[ ! -d "$target_release" ]]; then
        error "Target release not found: $target_release"
    fi

    # Verify target release
    if [[ ! -f "$target_release/package.json" ]]; then
        error "Target release appears to be incomplete: missing package.json"
    fi

    # Stop current application
    log "Stopping current application..."
    systemctl stop boutique-client || pm2 stop all || true

    # Update symlink to target release
    log "Switching to target release..."
    rm -f "$PROJECT_ROOT/current"
    ln -sf "$target_release" "$PROJECT_ROOT/current"

    # Restore database if backup exists for this release
    local release_db_backup="$target_release/database-backup.sql.gz"
    if [[ -f "$release_db_backup" ]]; then
        log "Found database backup for this release, restoring..."
        BACKUP_FILE="$release_db_backup"
        restore_database
    else
        warning "No database backup found for this release"
    fi

    # Start application with rolled back version
    log "Starting application with rolled back version..."
    cd "$PROJECT_ROOT/current"
    systemctl start boutique-client || pm2 start ecosystem.config.js || true

    success "Deployment rollback completed"
}

# =============================================================================
# Post-Recovery Validation
# =============================================================================

validate_recovery() {
    log "Running post-recovery validation..."

    # Wait for application to start
    sleep 10

    # Check database connectivity
    if ! pg_isready -h localhost -p 5432 &> /dev/null; then
        warning "Database connectivity check failed"
        return 1
    fi

    # Check application health
    local health_url="http://localhost:3000/health"
    local max_attempts=12
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$health_url" &> /dev/null; then
            success "Application health check passed"
            break
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, waiting..."
        sleep 5
        ((attempt++))
    done

    if [[ $attempt -gt $max_attempts ]]; then
        warning "Application health check failed after $max_attempts attempts"
        return 1
    fi

    # Check critical database tables
    if psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM users;" &> /dev/null; then
        success "Database table validation passed"
    else
        warning "Database table validation failed"
        return 1
    fi

    # Check log files for errors
    if [[ -f "$PROJECT_ROOT/logs/error.log" ]]; then
        local recent_errors=$(find "$PROJECT_ROOT/logs/error.log" -mmin -5 -exec wc -l {} \; 2>/dev/null || echo "0")
        if [[ "$recent_errors" -gt 5 ]]; then
            warning "High number of recent errors in logs: $recent_errors"
            return 1
        fi
    fi

    success "Post-recovery validation completed successfully"
    return 0
}

# =============================================================================
# Main Recovery Flow
# =============================================================================

main() {
    log "Starting disaster recovery process..."
    log "Scenario: $SCENARIO"
    log "Dry Run: $DRY_RUN"

    # Load database configuration
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        source "$PROJECT_ROOT/.env.production"
        DB_USER="${DB_USER:-postgres}"
        DB_NAME="${DB_NAME:-boutique_prod}"
    else
        error "Production environment file not found"
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        warning "DRY RUN MODE - No changes will be made"
    fi

    # Show critical warning
    if [[ "$FORCE" != "true" ]]; then
        echo
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}        DISASTER RECOVERY WARNING       ${NC}"
        echo -e "${RED}========================================${NC}"
        echo
        echo -e "${YELLOW}This operation will make significant changes to your system.${NC}"
        echo -e "${YELLOW}Scenario: $SCENARIO${NC}"
        echo
        if ! confirm "Are you absolutely sure you want to continue?"; then
            log "Recovery operation cancelled by user"
            exit 0
        fi
    fi

    pre_recovery_checks

    case "$SCENARIO" in
        db-restore)
            find_backup_file
            verify_backup_integrity
            if [[ "$VERIFY_ONLY" != "true" ]]; then
                restore_database
                validate_recovery
            fi
            ;;
        full-restore)
            find_backup_file
            verify_backup_integrity
            if [[ "$VERIFY_ONLY" != "true" ]]; then
                restore_full_system
                validate_recovery
            fi
            ;;
        rollback)
            rollback_deployment
            validate_recovery
            ;;
    esac

    success "Disaster recovery process completed successfully!"
    
    echo
    echo "=== Recovery Summary ==="
    echo "📅 Recovery Date: $(date)"
    echo "🎯 Scenario: $SCENARIO"
    echo "📁 Backup Used: ${BACKUP_FILE:-$ROLLBACK_TO}"
    echo "📋 Log File: $RECOVERY_LOG"
    echo
    echo "=== Next Steps ==="
    echo "1. Monitor application logs for any issues"
    echo "2. Run comprehensive tests to verify functionality"
    echo "3. Notify stakeholders of recovery completion"
    echo "4. Review and update recovery procedures if needed"
    echo
}

# =============================================================================
# Script Execution
# =============================================================================

# Trap errors
trap 'error "Recovery process failed at line $LINENO"' ERR

# Parse arguments and run main function
parse_args "$@"
main