#!/bin/bash

# =============================================================================
# Database Restore Script for Boutique Client Portal
# =============================================================================
# 
# This script restores PostgreSQL database backups with:
# - Support for compressed and uncompressed backups
# - Pre-restore validation and safety checks
# - Optional database recreation
# - Rollback capability
# - Progress monitoring
# 
# Usage:
#   ./scripts/database-restore.sh BACKUP_FILE [OPTIONS]
#   
# Options:
#   --target-db     Target database name (default: from DATABASE_URL)
#   --recreate      Drop and recreate database before restore
#   --force         Skip confirmation prompts
#   --verify        Verify restore after completion
#   --rollback      Create rollback backup before restore
#   --quiet         Suppress non-error output
#   --dry-run       Show what would be done without executing
#
# Examples:
#   ./scripts/database-restore.sh backups/database/boutique_client_full_20250105_120000.sql.gz
#   ./scripts/database-restore.sh backup.sql --recreate --verify
#   ./scripts/database-restore.sh backup.sql --target-db test_db --force
#
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups/database"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/database-restore.log"

# Default configuration
DEFAULT_TARGET_DB=""
DEFAULT_RECREATE="false"
DEFAULT_FORCE="false"
DEFAULT_VERIFY="true"
DEFAULT_ROLLBACK="true"
DEFAULT_QUIET="false"
DEFAULT_DRY_RUN="false"

# Load configuration from environment or use defaults
TARGET_DB="${TARGET_DB:-$DEFAULT_TARGET_DB}"
RECREATE_DB="${RECREATE_DB:-$DEFAULT_RECREATE}"
FORCE_MODE="${FORCE_MODE:-$DEFAULT_FORCE}"
VERIFY_RESTORE="${VERIFY_RESTORE:-$DEFAULT_VERIFY}"
CREATE_ROLLBACK="${CREATE_ROLLBACK:-$DEFAULT_ROLLBACK}"
QUIET_MODE="${QUIET_MODE:-$DEFAULT_QUIET}"
DRY_RUN="${DRY_RUN:-$DEFAULT_DRY_RUN}"

# Parse command line arguments
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 BACKUP_FILE [OPTIONS]"
    echo "Use --help for detailed information"
    exit 1
fi

BACKUP_FILE="$1"
shift

while [[ $# -gt 0 ]]; do
    case $1 in
        --target-db)
            TARGET_DB="$2"
            shift 2
            ;;
        --recreate)
            RECREATE_DB="true"
            shift
            ;;
        --force)
            FORCE_MODE="true"
            shift
            ;;
        --verify)
            VERIFY_RESTORE="true"
            shift
            ;;
        --no-verify)
            VERIFY_RESTORE="false"
            shift
            ;;
        --rollback)
            CREATE_ROLLBACK="true"
            shift
            ;;
        --no-rollback)
            CREATE_ROLLBACK="false"
            shift
            ;;
        --quiet)
            QUIET_MODE="true"
            shift
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        -h|--help)
            echo "Database Restore Script for Boutique Client Portal"
            echo ""
            echo "Usage: $0 BACKUP_FILE [OPTIONS]"
            echo ""
            echo "Arguments:"
            echo "  BACKUP_FILE       Path to backup file (.sql or .sql.gz)"
            echo ""
            echo "Options:"
            echo "  --target-db DB    Target database name (default: from DATABASE_URL)"
            echo "  --recreate        Drop and recreate database before restore"
            echo "  --force           Skip confirmation prompts"
            echo "  --verify          Verify restore after completion"
            echo "  --no-verify       Skip restore verification"
            echo "  --rollback        Create rollback backup before restore"
            echo "  --no-rollback     Skip rollback backup creation"
            echo "  --quiet           Suppress non-error output"
            echo "  --dry-run         Show what would be done without executing"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 backup.sql.gz                     # Basic restore"
            echo "  $0 backup.sql --recreate --verify    # Full restore with verification"
            echo "  $0 backup.sql --target-db test_db    # Restore to different database"
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    if [[ "$QUIET_MODE" != "true" ]]; then
        echo "[$timestamp] INFO: $message"
    fi
    mkdir -p "$LOG_DIR"
    echo "[$timestamp] INFO: $message" >> "$LOG_FILE"
}

log_error() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ERROR: $message" >&2
    mkdir -p "$LOG_DIR"
    echo "[$timestamp] ERROR: $message" >> "$LOG_FILE"
}

log_warning() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    if [[ "$QUIET_MODE" != "true" ]]; then
        echo "[$timestamp] WARNING: $message"
    fi
    mkdir -p "$LOG_DIR"
    echo "[$timestamp] WARNING: $message" >> "$LOG_FILE"
}

# Prompt for confirmation
confirm_action() {
    local message="$1"
    
    if [[ "$FORCE_MODE" == "true" ]]; then
        log_info "Force mode enabled, skipping confirmation"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would prompt: $message"
        return 0
    fi
    
    echo -n "$message (y/N): "
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Validation functions
validate_environment() {
    log_info "Validating environment and dependencies..."
    
    # Check if required tools are available
    if ! command -v psql &> /dev/null; then
        log_error "psql not found. Please install PostgreSQL client tools."
        exit 1
    fi
    
    if ! command -v pg_restore &> /dev/null; then
        log_error "pg_restore not found. Please install PostgreSQL client tools."
        exit 1
    fi
    
    # Check if environment file exists
    if [[ ! -f "${PROJECT_ROOT}/.env" ]]; then
        log_error ".env file not found in project root"
        exit 1
    fi
    
    # Load environment variables
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a
    
    # Validate required environment variables
    if [[ -z "${DATABASE_URL:-}" ]]; then
        log_error "DATABASE_URL not set in environment"
        exit 1
    fi
    
    # Parse database connection details
    if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/([^?]+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASSWORD="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
    else
        log_error "Invalid DATABASE_URL format"
        exit 1
    fi
    
    # Set target database
    if [[ -z "$TARGET_DB" ]]; then
        TARGET_DB="$DB_NAME"
    fi
    
    log_info "Database connection: $DB_HOST:$DB_PORT/$TARGET_DB"
}

validate_backup_file() {
    log_info "Validating backup file: $BACKUP_FILE"
    
    # Check if backup file exists
    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    # Check if backup file is readable
    if [[ ! -r "$BACKUP_FILE" ]]; then
        log_error "Backup file is not readable: $BACKUP_FILE"
        exit 1
    fi
    
    # Check if backup file is not empty
    if [[ ! -s "$BACKUP_FILE" ]]; then
        log_error "Backup file is empty: $BACKUP_FILE"
        exit 1
    fi
    
    # Validate file format
    local file_extension=""
    if [[ "$BACKUP_FILE" == *.sql.gz ]]; then
        file_extension="sql.gz"
        # Test gzip integrity
        if ! gzip -t "$BACKUP_FILE"; then
            log_error "Backup file is corrupted (gzip test failed): $BACKUP_FILE"
            exit 1
        fi
    elif [[ "$BACKUP_FILE" == *.sql ]]; then
        file_extension="sql"
    else
        log_error "Unsupported backup file format. Use .sql or .sql.gz files."
        exit 1
    fi
    
    local backup_size=$(du -h "$BACKUP_FILE" | cut -f1)
    log_info "Backup file validated: $file_extension format, $backup_size"
    
    # Basic content validation for SQL files
    local test_command
    if [[ "$file_extension" == "sql.gz" ]]; then
        test_command="zcat '$BACKUP_FILE' | head -20 | grep -E '^(--|CREATE|INSERT|COPY|\\\\)' > /dev/null"
    else
        test_command="head -20 '$BACKUP_FILE' | grep -E '^(--|CREATE|INSERT|COPY|\\\\)' > /dev/null"
    fi
    
    if ! eval "$test_command"; then
        log_error "Backup file does not appear to be a valid SQL dump"
        exit 1
    fi
    
    log_info "Backup file content validation passed"
}

# Database connectivity test
test_database_connection() {
    log_info "Testing database connectivity..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would test connection to $DB_HOST:$DB_PORT"
        return
    fi
    
    # Test connection with a simple query
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "SELECT 1;" &> /dev/null; then
        log_error "Failed to connect to database server"
        exit 1
    fi
    
    log_info "Database server connection successful"
}

# Check if target database exists
check_target_database() {
    log_info "Checking target database: $TARGET_DB"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would check if database '$TARGET_DB' exists"
        return 0
    fi
    
    # Check if database exists
    local db_exists
    db_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -tAc "SELECT 1 FROM pg_database WHERE datname='$TARGET_DB';" || echo "")
    
    if [[ "$db_exists" == "1" ]]; then
        log_info "Target database '$TARGET_DB' exists"
        return 0
    else
        log_info "Target database '$TARGET_DB' does not exist"
        return 1
    fi
}

# Create rollback backup
create_rollback_backup() {
    if [[ "$CREATE_ROLLBACK" != "true" ]]; then
        log_info "Rollback backup creation skipped"
        return
    fi
    
    log_info "Creating rollback backup..."
    
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local rollback_file="${BACKUP_DIR}/rollback_${TARGET_DB}_${timestamp}.sql.gz"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create rollback backup: $rollback_file"
        return
    fi
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Create rollback backup
    export PGPASSWORD="$DB_PASSWORD"
    
    if ! pg_dump --verbose --clean --if-exists --create -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TARGET_DB" | gzip > "$rollback_file"; then
        log_error "Failed to create rollback backup"
        unset PGPASSWORD
        exit 1
    fi
    
    unset PGPASSWORD
    
    # Verify rollback backup was created
    if [[ ! -f "$rollback_file" ]] || [[ ! -s "$rollback_file" ]]; then
        log_error "Rollback backup file is empty or was not created"
        exit 1
    fi
    
    local rollback_size=$(du -h "$rollback_file" | cut -f1)
    log_info "Rollback backup created: $rollback_file ($rollback_size)"
}

# Recreate database
recreate_database() {
    if [[ "$RECREATE_DB" != "true" ]]; then
        log_info "Database recreation skipped"
        return
    fi
    
    log_info "Recreating database: $TARGET_DB"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would drop and recreate database: $TARGET_DB"
        return
    fi
    
    if ! confirm_action "This will DROP the database '$TARGET_DB' and recreate it. Continue?"; then
        log_info "Database recreation cancelled by user"
        exit 1
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Terminate active connections to the target database
    log_info "Terminating active connections to database: $TARGET_DB"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();" || true
    
    # Drop database if it exists
    log_info "Dropping database: $TARGET_DB"
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";"; then
        log_error "Failed to drop database"
        unset PGPASSWORD
        exit 1
    fi
    
    # Create database
    log_info "Creating database: $TARGET_DB"
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "CREATE DATABASE \"$TARGET_DB\";"; then
        log_error "Failed to create database"
        unset PGPASSWORD
        exit 1
    fi
    
    unset PGPASSWORD
    
    log_info "Database recreated successfully"
}

# Restore database
restore_database() {
    log_info "Starting database restore from: $BACKUP_FILE"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would restore backup to database: $TARGET_DB"
        return
    fi
    
    if ! confirm_action "This will restore the backup to database '$TARGET_DB'. Continue?"; then
        log_info "Database restore cancelled by user"
        exit 1
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
    
    local restore_command
    if [[ "$BACKUP_FILE" == *.sql.gz ]]; then
        restore_command="zcat '$BACKUP_FILE' | psql -h '$DB_HOST' -p '$DB_PORT' -U '$DB_USER' -d '$TARGET_DB' -v ON_ERROR_STOP=1"
    else
        restore_command="psql -h '$DB_HOST' -p '$DB_PORT' -U '$DB_USER' -d '$TARGET_DB' -v ON_ERROR_STOP=1 -f '$BACKUP_FILE'"
    fi
    
    log_info "Executing restore command..."
    
    if ! eval "$restore_command"; then
        log_error "Database restore failed"
        unset PGPASSWORD
        exit 1
    fi
    
    unset PGPASSWORD
    
    log_info "Database restore completed successfully"
}

# Verify restore
verify_restore() {
    if [[ "$VERIFY_RESTORE" != "true" ]]; then
        log_info "Restore verification skipped"
        return
    fi
    
    log_info "Verifying database restore..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would verify restored database"
        return
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if database is accessible
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -c "SELECT 1;" &> /dev/null; then
        log_error "Cannot connect to restored database"
        unset PGPASSWORD
        exit 1
    fi
    
    # Count tables (basic verification)
    local table_count
    table_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    
    unset PGPASSWORD
    
    log_info "Database verification completed: $table_count tables found"
    
    if [[ "$table_count" -eq 0 ]]; then
        log_warning "No tables found in restored database - this may indicate an issue"
    fi
}

# Generate restore report
generate_report() {
    local start_time="$1"
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    log_info "Generating restore report..."
    
    local report_file="${LOG_DIR}/restore-report-$(date '+%Y%m%d_%H%M%S').txt"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would generate report: $report_file"
        return
    fi
    
    local backup_size=$(du -h "$BACKUP_FILE" 2>/dev/null | cut -f1 || echo "N/A")
    
    cat > "$report_file" << EOF
=============================================================================
Database Restore Report - Boutique Client Portal
=============================================================================

Restore Details:
  Backup File:    $BACKUP_FILE
  Backup Size:    $backup_size
  Target DB:      $TARGET_DB
  Recreated:      $RECREATE_DB
  Rollback:       $CREATE_ROLLBACK
  
Database Details:
  Host:           $DB_HOST
  Port:           $DB_PORT
  User:           $DB_USER
  
Timing:
  Start Time:     $start_time
  End Time:       $end_time
  Duration:       $(($(date -d "$end_time" +%s) - $(date -d "$start_time" +%s))) seconds
  
Configuration:
  Force Mode:     $FORCE_MODE
  Verification:   $VERIFY_RESTORE
  
Status:         SUCCESS
Generated:      $(date '+%Y-%m-%d %H:%M:%S')

=============================================================================
EOF
    
    log_info "Restore report saved: $report_file"
}

# Main execution
main() {
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    log_info "Starting database restore process..."
    log_info "Backup file: $BACKUP_FILE"
    log_info "Target database: $TARGET_DB"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN MODE - No actual changes will be made"
    fi
    
    # Execute restore steps
    validate_environment
    validate_backup_file
    test_database_connection
    
    # Check if target database exists (for rollback and recreation logic)
    local db_exists=false
    if check_target_database; then
        db_exists=true
    fi
    
    # Create rollback backup if database exists
    if [[ "$db_exists" == true ]]; then
        create_rollback_backup
    fi
    
    # Recreate database if requested
    recreate_database
    
    # Create database if it doesn't exist and recreation wasn't requested
    if [[ "$db_exists" == false && "$RECREATE_DB" != "true" ]]; then
        log_info "Creating target database: $TARGET_DB"
        if [[ "$DRY_RUN" != "true" ]]; then
            export PGPASSWORD="$DB_PASSWORD"
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "CREATE DATABASE \"$TARGET_DB\";" || true
            unset PGPASSWORD
        fi
    fi
    
    # Perform the restore
    restore_database
    
    # Verify the restore
    verify_restore
    
    # Generate report
    generate_report "$start_time"
    
    log_info "Database restore process completed successfully"
}

# Error handling
trap 'log_error "Restore process failed at line $LINENO"' ERR

# Execute main function
main "$@"