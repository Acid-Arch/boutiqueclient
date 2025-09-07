#!/bin/bash

# =============================================================================
# Database Backup Script for Boutique Client Portal
# =============================================================================
# 
# This script creates automated backups of the PostgreSQL database with:
# - Full database dumps with schema and data
# - Compression to save storage space
# - Rotation to maintain backup history
# - Backup verification
# - Optional upload to cloud storage
# 
# Usage:
#   ./scripts/database-backup.sh [OPTIONS]
#   
# Options:
#   --type        Backup type: full (default), schema-only, data-only
#   --compress    Compression: gzip (default), none
#   --retention   Days to retain backups (default: 30)
#   --verify      Verify backup after creation (default: true)
#   --upload      Upload to cloud storage (default: false)
#   --quiet       Suppress non-error output
#   --dry-run     Show what would be done without executing
#
# Examples:
#   ./scripts/database-backup.sh                    # Full backup with defaults
#   ./scripts/database-backup.sh --type schema-only # Schema backup only
#   ./scripts/database-backup.sh --upload --verify  # Full backup with upload and verification
#
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups/database"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/database-backup.log"

# Default configuration
DEFAULT_TYPE="full"
DEFAULT_COMPRESS="gzip"
DEFAULT_RETENTION="30"
DEFAULT_VERIFY="true"
DEFAULT_UPLOAD="false"
DEFAULT_QUIET="false"
DEFAULT_DRY_RUN="false"

# Load configuration from environment or use defaults
BACKUP_TYPE="${BACKUP_TYPE:-$DEFAULT_TYPE}"
BACKUP_COMPRESS="${BACKUP_COMPRESS:-$DEFAULT_COMPRESS}"
BACKUP_RETENTION="${BACKUP_RETENTION:-$DEFAULT_RETENTION}"
BACKUP_VERIFY="${BACKUP_VERIFY:-$DEFAULT_VERIFY}"
BACKUP_UPLOAD="${BACKUP_UPLOAD:-$DEFAULT_UPLOAD}"
QUIET_MODE="${QUIET_MODE:-$DEFAULT_QUIET}"
DRY_RUN="${DRY_RUN:-$DEFAULT_DRY_RUN}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        --compress)
            BACKUP_COMPRESS="$2"
            shift 2
            ;;
        --retention)
            BACKUP_RETENTION="$2"
            shift 2
            ;;
        --verify)
            BACKUP_VERIFY="true"
            shift
            ;;
        --no-verify)
            BACKUP_VERIFY="false"
            shift
            ;;
        --upload)
            BACKUP_UPLOAD="true"
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
            echo "Database Backup Script for Boutique Client Portal"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --type TYPE       Backup type: full, schema-only, data-only (default: full)"
            echo "  --compress TYPE   Compression: gzip, none (default: gzip)"
            echo "  --retention DAYS  Days to retain backups (default: 30)"
            echo "  --verify          Verify backup after creation"
            echo "  --no-verify       Skip backup verification"
            echo "  --upload          Upload to cloud storage"
            echo "  --quiet           Suppress non-error output"
            echo "  --dry-run         Show what would be done without executing"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                           # Full backup with defaults"
            echo "  $0 --type schema-only        # Schema backup only"
            echo "  $0 --upload --verify         # Full backup with upload and verification"
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
    echo "[$timestamp] INFO: $message" >> "$LOG_FILE"
}

log_error() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ERROR: $message" >&2
    echo "[$timestamp] ERROR: $message" >> "$LOG_FILE"
}

log_warning() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    if [[ "$QUIET_MODE" != "true" ]]; then
        echo "[$timestamp] WARNING: $message"
    fi
    echo "[$timestamp] WARNING: $message" >> "$LOG_FILE"
}

# Validation functions
validate_environment() {
    log_info "Validating environment and dependencies..."
    
    # Check if pg_dump is available
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump not found. Please install PostgreSQL client tools."
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
    
    # Validate backup type
    case "$BACKUP_TYPE" in
        full|schema-only|data-only)
            ;;
        *)
            log_error "Invalid backup type: $BACKUP_TYPE (must be: full, schema-only, data-only)"
            exit 1
            ;;
    esac
    
    # Validate compression type
    case "$BACKUP_COMPRESS" in
        gzip|none)
            ;;
        *)
            log_error "Invalid compression type: $BACKUP_COMPRESS (must be: gzip, none)"
            exit 1
            ;;
    esac
    
    # Check if compression tool is available
    if [[ "$BACKUP_COMPRESS" == "gzip" ]] && ! command -v gzip &> /dev/null; then
        log_error "gzip not found but compression requested"
        exit 1
    fi
}

# Directory setup
setup_directories() {
    log_info "Setting up backup directories..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create directories: $BACKUP_DIR, $LOG_DIR"
        return
    fi
    
    # Create backup and log directories if they don't exist
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
    
    # Set appropriate permissions
    chmod 750 "$BACKUP_DIR"
    chmod 750 "$LOG_DIR"
}

# Database connectivity test
test_database_connection() {
    log_info "Testing database connectivity..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would test connection to $DB_HOST:$DB_PORT/$DB_NAME"
        return
    fi
    
    # Test connection with a simple query
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        log_error "Failed to connect to database"
        exit 1
    fi
    
    log_info "Database connection successful"
}

# Create backup
create_backup() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_name="boutique_client_${BACKUP_TYPE}_${timestamp}"
    local backup_file="${BACKUP_DIR}/${backup_name}.sql"
    
    log_info "Creating ${BACKUP_TYPE} backup..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create backup: $backup_file"
        if [[ "$BACKUP_COMPRESS" == "gzip" ]]; then
            log_info "[DRY RUN] Would compress to: ${backup_file}.gz"
        fi
        echo "$backup_file" # Return the filename for other functions
        return
    fi
    
    # Set pg_dump options based on backup type
    local pg_dump_opts=""
    case "$BACKUP_TYPE" in
        full)
            pg_dump_opts="--verbose --clean --if-exists --create"
            ;;
        schema-only)
            pg_dump_opts="--verbose --clean --if-exists --schema-only"
            ;;
        data-only)
            pg_dump_opts="--verbose --data-only --disable-triggers"
            ;;
    esac
    
    # Export password for pg_dump
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create backup
    if [[ "$BACKUP_COMPRESS" == "gzip" ]]; then
        backup_file="${backup_file}.gz"
        log_info "Creating compressed backup: $backup_file"
        
        if ! pg_dump $pg_dump_opts -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$backup_file"; then
            log_error "Failed to create compressed backup"
            exit 1
        fi
    else
        log_info "Creating uncompressed backup: $backup_file"
        
        if ! pg_dump $pg_dump_opts -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$backup_file"; then
            log_error "Failed to create backup"
            exit 1
        fi
    fi
    
    # Unset password
    unset PGPASSWORD
    
    # Check if backup file was created and has content
    if [[ ! -f "$backup_file" ]] || [[ ! -s "$backup_file" ]]; then
        log_error "Backup file is empty or was not created"
        exit 1
    fi
    
    local backup_size=$(du -h "$backup_file" | cut -f1)
    log_info "Backup created successfully: $backup_file ($backup_size)"
    
    echo "$backup_file" # Return the filename for other functions
}

# Verify backup
verify_backup() {
    local backup_file="$1"
    
    if [[ "$BACKUP_VERIFY" != "true" ]]; then
        log_info "Backup verification skipped"
        return
    fi
    
    log_info "Verifying backup integrity..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would verify backup: $backup_file"
        return
    fi
    
    # Check if backup file exists and is not empty
    if [[ ! -f "$backup_file" ]] || [[ ! -s "$backup_file" ]]; then
        log_error "Backup file is missing or empty"
        exit 1
    fi
    
    # For gzipped files, test compression integrity
    if [[ "$backup_file" == *.gz ]]; then
        if ! gzip -t "$backup_file"; then
            log_error "Backup file is corrupted (gzip test failed)"
            exit 1
        fi
        log_info "Compressed backup integrity verified"
    fi
    
    # For SQL files, do a basic syntax check
    if [[ "$backup_file" == *.sql ]] || [[ "$backup_file" == *.sql.gz ]]; then
        local test_command
        if [[ "$backup_file" == *.gz ]]; then
            test_command="zcat '$backup_file' | head -20 | grep -E '^(--|CREATE|INSERT|COPY)' > /dev/null"
        else
            test_command="head -20 '$backup_file' | grep -E '^(--|CREATE|INSERT|COPY)' > /dev/null"
        fi
        
        if ! eval "$test_command"; then
            log_error "Backup file does not appear to be a valid SQL dump"
            exit 1
        fi
        log_info "SQL backup format verified"
    fi
    
    log_info "Backup verification completed successfully"
}

# Clean old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${BACKUP_RETENTION} days..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        local old_files=$(find "$BACKUP_DIR" -name "boutique_client_*.sql*" -type f -mtime +"$BACKUP_RETENTION" 2>/dev/null || true)
        if [[ -n "$old_files" ]]; then
            log_info "[DRY RUN] Would remove old backup files:"
            echo "$old_files"
        else
            log_info "[DRY RUN] No old backup files to remove"
        fi
        return
    fi
    
    local deleted_count=0
    while IFS= read -r -d '' file; do
        log_info "Removing old backup: $(basename "$file")"
        rm "$file"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "boutique_client_*.sql*" -type f -mtime +"$BACKUP_RETENTION" -print0 2>/dev/null)
    
    if [[ $deleted_count -gt 0 ]]; then
        log_info "Removed $deleted_count old backup files"
    else
        log_info "No old backup files to remove"
    fi
}

# Upload to cloud storage (placeholder - implement based on your cloud provider)
upload_backup() {
    local backup_file="$1"
    
    if [[ "$BACKUP_UPLOAD" != "true" ]]; then
        log_info "Cloud upload skipped"
        return
    fi
    
    log_info "Uploading backup to cloud storage..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would upload backup: $backup_file"
        return
    fi
    
    # Placeholder for cloud upload implementation
    # Replace this with your actual cloud storage solution (AWS S3, Google Cloud Storage, etc.)
    
    # Example for AWS S3:
    # aws s3 cp "$backup_file" "s3://your-backup-bucket/database-backups/$(basename "$backup_file")"
    
    # Example for Google Cloud Storage:
    # gsutil cp "$backup_file" "gs://your-backup-bucket/database-backups/$(basename "$backup_file")"
    
    # For now, just log that upload would happen
    log_warning "Cloud upload not implemented. Please configure your cloud storage solution."
    log_info "Backup file ready for manual upload: $backup_file"
}

# Generate backup report
generate_report() {
    local backup_file="$1"
    local start_time="$2"
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    log_info "Generating backup report..."
    
    local report_file="${LOG_DIR}/backup-report-$(date '+%Y%m%d_%H%M%S').txt"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would generate report: $report_file"
        return
    fi
    
    cat > "$report_file" << EOF
=============================================================================
Database Backup Report - Boutique Client Portal
=============================================================================

Backup Details:
  Type:           $BACKUP_TYPE
  Compression:    $BACKUP_COMPRESS
  File:           $backup_file
  Size:           $(du -h "$backup_file" 2>/dev/null | cut -f1 || echo "N/A")
  
Database Details:
  Host:           $DB_HOST
  Port:           $DB_PORT
  Database:       $DB_NAME
  User:           $DB_USER
  
Timing:
  Start Time:     $start_time
  End Time:       $end_time
  Duration:       $(($(date -d "$end_time" +%s) - $(date -d "$start_time" +%s))) seconds
  
Configuration:
  Verification:   $BACKUP_VERIFY
  Cloud Upload:   $BACKUP_UPLOAD
  Retention:      $BACKUP_RETENTION days
  
Status:         SUCCESS
Generated:      $(date '+%Y-%m-%d %H:%M:%S')

=============================================================================
EOF
    
    log_info "Backup report saved: $report_file"
}

# Main execution
main() {
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    log_info "Starting database backup process..."
    log_info "Configuration: type=$BACKUP_TYPE, compress=$BACKUP_COMPRESS, retention=${BACKUP_RETENTION}d"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN MODE - No actual changes will be made"
    fi
    
    # Execute backup steps
    validate_environment
    setup_directories
    test_database_connection
    
    local backup_file
    backup_file=$(create_backup)
    
    verify_backup "$backup_file"
    upload_backup "$backup_file"
    cleanup_old_backups
    generate_report "$backup_file" "$start_time"
    
    log_info "Database backup process completed successfully"
    log_info "Backup file: $backup_file"
}

# Error handling
trap 'log_error "Backup process failed at line $LINENO"' ERR

# Execute main function
main "$@"