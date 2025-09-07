#!/bin/bash

# =============================================================================
# Database Migration Manager for Boutique Client Portal
# =============================================================================
# 
# This script provides comprehensive migration management with:
# - Migration validation before execution
# - Automatic rollback capability
# - Migration status tracking
# - Safety checks and confirmations
# - Schema drift detection
# 
# Usage:
#   ./scripts/migration-manager.sh COMMAND [OPTIONS]
#   
# Commands:
#   validate    Validate pending migrations without applying
#   apply       Apply pending migrations with safety checks
#   rollback    Rollback the last migration
#   status      Show current migration status
#   create      Create a new migration file
#   reset       Reset database and apply all migrations (DANGEROUS)
#   drift       Check for schema drift
#
# Options:
#   --force         Skip confirmation prompts
#   --dry-run       Show what would be done without executing
#   --backup        Create backup before migration (default: true)
#   --no-backup     Skip backup creation
#   --environment   Target environment (development, staging, production)
#   --quiet         Suppress non-error output
#   --verbose       Enable detailed logging
#
# Examples:
#   ./scripts/migration-manager.sh status
#   ./scripts/migration-manager.sh validate --environment production
#   ./scripts/migration-manager.sh apply --backup
#   ./scripts/migration-manager.sh rollback --force
#
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="${PROJECT_ROOT}/prisma/migrations"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/migration-manager.log"

# Default configuration
DEFAULT_FORCE="false"
DEFAULT_DRY_RUN="false"
DEFAULT_BACKUP="true"
DEFAULT_ENVIRONMENT="development"
DEFAULT_QUIET="false"
DEFAULT_VERBOSE="false"

# Parse command
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo "Commands: validate, apply, rollback, status, create, reset, drift"
    echo "Use --help for detailed information"
    exit 1
fi

COMMAND="$1"
shift

# Load configuration from environment or use defaults
FORCE_MODE="${FORCE_MODE:-$DEFAULT_FORCE}"
DRY_RUN="${DRY_RUN:-$DEFAULT_DRY_RUN}"
CREATE_BACKUP="${CREATE_BACKUP:-$DEFAULT_BACKUP}"
ENVIRONMENT="${ENVIRONMENT:-$DEFAULT_ENVIRONMENT}"
QUIET_MODE="${QUIET_MODE:-$DEFAULT_QUIET}"
VERBOSE_MODE="${VERBOSE_MODE:-$DEFAULT_VERBOSE}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_MODE="true"
            shift
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --backup)
            CREATE_BACKUP="true"
            shift
            ;;
        --no-backup)
            CREATE_BACKUP="false"
            shift
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --quiet)
            QUIET_MODE="true"
            shift
            ;;
        --verbose)
            VERBOSE_MODE="true"
            shift
            ;;
        -h|--help)
            echo "Database Migration Manager for Boutique Client Portal"
            echo ""
            echo "Usage: $0 COMMAND [OPTIONS]"
            echo ""
            echo "Commands:"
            echo "  validate    Validate pending migrations without applying"
            echo "  apply       Apply pending migrations with safety checks"
            echo "  rollback    Rollback the last migration"
            echo "  status      Show current migration status"
            echo "  create      Create a new migration file"
            echo "  reset       Reset database and apply all migrations (DANGEROUS)"
            echo "  drift       Check for schema drift"
            echo ""
            echo "Options:"
            echo "  --force         Skip confirmation prompts"
            echo "  --dry-run       Show what would be done without executing"
            echo "  --backup        Create backup before migration (default: true)"
            echo "  --no-backup     Skip backup creation"
            echo "  --environment   Target environment (development, staging, production)"
            echo "  --quiet         Suppress non-error output"
            echo "  --verbose       Enable detailed logging"
            echo ""
            echo "Examples:"
            echo "  $0 status"
            echo "  $0 validate --environment production"
            echo "  $0 apply --backup"
            echo "  $0 rollback --force"
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

log_verbose() {
    local message="$1"
    if [[ "$VERBOSE_MODE" == "true" ]]; then
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        echo "[$timestamp] VERBOSE: $message"
        mkdir -p "$LOG_DIR"
        echo "[$timestamp] VERBOSE: $message" >> "$LOG_FILE"
    fi
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
    log_verbose "Validating environment and dependencies..."
    
    # Check if required tools are available
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump not found. Please install PostgreSQL client tools."
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        log_error "psql not found. Please install PostgreSQL client tools."
        exit 1
    fi
    
    # Check if migrations directory exists
    if [[ ! -d "$MIGRATIONS_DIR" ]]; then
        log_error "Migrations directory not found: $MIGRATIONS_DIR"
        exit 1
    fi
    
    # Load environment file based on environment
    local env_file="${PROJECT_ROOT}/.env"
    case "$ENVIRONMENT" in
        development)
            env_file="${PROJECT_ROOT}/.env"
            ;;
        staging)
            env_file="${PROJECT_ROOT}/.env.staging"
            ;;
        production)
            env_file="${PROJECT_ROOT}/.env.production"
            ;;
    esac
    
    if [[ ! -f "$env_file" ]]; then
        log_error "Environment file not found: $env_file"
        exit 1
    fi
    
    # Load environment variables
    set -a
    source "$env_file"
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
    
    log_verbose "Environment: $ENVIRONMENT"
    log_verbose "Database: $DB_HOST:$DB_PORT/$DB_NAME"
    log_verbose "Migrations directory: $MIGRATIONS_DIR"
}

# Test database connectivity
test_database_connection() {
    log_verbose "Testing database connectivity..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would test connection to $DB_HOST:$DB_PORT/$DB_NAME"
        return
    fi
    
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        log_error "Failed to connect to database"
        exit 1
    fi
    
    log_verbose "Database connection successful"
}

# Get migration status
get_migration_status() {
    log_verbose "Getting migration status..."
    
    # Check if _prisma_migrations table exists
    local migrations_table_exists
    migrations_table_exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations');" 2>/dev/null || echo "false")
    
    if [[ "$migrations_table_exists" != "t" ]]; then
        log_info "No migration history found. Database appears to be uninitialized."
        return 1
    fi
    
    # Get applied migrations
    local applied_migrations
    applied_migrations=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name;" 2>/dev/null || echo "")
    
    # Get available migrations
    local available_migrations=""
    if [[ -d "$MIGRATIONS_DIR" ]]; then
        available_migrations=$(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)
    fi
    
    # Compare applied vs available
    echo "APPLIED_MIGRATIONS<<EOF"
    echo "$applied_migrations"
    echo "EOF"
    
    echo "AVAILABLE_MIGRATIONS<<EOF"
    echo "$available_migrations"
    echo "EOF"
    
    # Find pending migrations
    local pending_migrations=""
    while IFS= read -r migration; do
        if [[ -n "$migration" ]] && ! echo "$applied_migrations" | grep -q "^$migration$"; then
            if [[ -n "$pending_migrations" ]]; then
                pending_migrations="$pending_migrations\n$migration"
            else
                pending_migrations="$migration"
            fi
        fi
    done <<< "$available_migrations"
    
    echo "PENDING_MIGRATIONS<<EOF"
    echo -e "$pending_migrations"
    echo "EOF"
    
    return 0
}

# Validate migrations
validate_migrations() {
    log_info "Validating pending migrations..."
    
    local status_output
    status_output=$(get_migration_status 2>/dev/null || echo "")
    
    if [[ -z "$status_output" ]]; then
        log_error "Failed to get migration status"
        exit 1
    fi
    
    # Parse status output
    local pending_migrations
    pending_migrations=$(echo "$status_output" | sed -n '/PENDING_MIGRATIONS<<EOF/,/^EOF$/p' | sed '1d;$d')
    
    if [[ -z "$pending_migrations" ]]; then
        log_info "✅ No pending migrations to validate"
        return 0
    fi
    
    log_info "Found pending migrations:"
    echo "$pending_migrations" | while IFS= read -r migration; do
        if [[ -n "$migration" ]]; then
            echo "  • $migration"
        fi
    done
    
    # Validate each migration file
    local validation_failed=false
    echo "$pending_migrations" | while IFS= read -r migration; do
        if [[ -n "$migration" ]]; then
            local migration_file="${MIGRATIONS_DIR}/${migration}/migration.sql"
            
            if [[ ! -f "$migration_file" ]]; then
                log_error "Migration file not found: $migration_file"
                validation_failed=true
                continue
            fi
            
            # Check if migration file is not empty
            if [[ ! -s "$migration_file" ]]; then
                log_error "Migration file is empty: $migration_file"
                validation_failed=true
                continue
            fi
            
            # Basic SQL syntax validation (check for common patterns)
            if ! grep -qE "(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)" "$migration_file"; then
                log_warning "Migration file may not contain valid SQL statements: $migration_file"
            fi
            
            log_verbose "✅ Migration validated: $migration"
        fi
    done
    
    if [[ "$validation_failed" == "true" ]]; then
        log_error "Migration validation failed"
        exit 1
    fi
    
    log_info "✅ All pending migrations validated successfully"
}

# Create backup before migration
create_pre_migration_backup() {
    if [[ "$CREATE_BACKUP" != "true" ]]; then
        log_info "Pre-migration backup skipped"
        return
    fi
    
    log_info "Creating pre-migration backup..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create pre-migration backup"
        return
    fi
    
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_dir="${PROJECT_ROOT}/backups/database"
    local backup_file="${backup_dir}/pre_migration_${timestamp}.sql.gz"
    
    # Create backup directory if it doesn't exist
    mkdir -p "$backup_dir"
    
    # Create backup
    export PGPASSWORD="$DB_PASSWORD"
    
    if ! pg_dump --verbose --clean --if-exists --create -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$backup_file"; then
        log_error "Failed to create pre-migration backup"
        unset PGPASSWORD
        exit 1
    fi
    
    unset PGPASSWORD
    
    # Verify backup was created
    if [[ ! -f "$backup_file" ]] || [[ ! -s "$backup_file" ]]; then
        log_error "Pre-migration backup file is empty or was not created"
        exit 1
    fi
    
    local backup_size=$(du -h "$backup_file" | cut -f1)
    log_info "✅ Pre-migration backup created: $backup_file ($backup_size)"
    
    echo "BACKUP_FILE=$backup_file"
}

# Apply pending migrations
apply_migrations() {
    log_info "Applying pending migrations..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would apply pending migrations using Prisma"
        return
    fi
    
    # Create backup first
    local backup_output
    backup_output=$(create_pre_migration_backup)
    local backup_file=""
    if [[ "$backup_output" =~ BACKUP_FILE=(.+) ]]; then
        backup_file="${BASH_REMATCH[1]}"
    fi
    
    # Apply migrations using Prisma
    log_info "Running Prisma migrate deploy..."
    
    export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
    
    if PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy; then
        log_info "✅ Migrations applied successfully"
    else
        log_error "Migration deployment failed"
        
        if [[ -n "$backup_file" ]]; then
            log_info "Pre-migration backup available for rollback: $backup_file"
        fi
        
        exit 1
    fi
}

# Rollback last migration
rollback_migration() {
    log_warning "Rolling back last migration..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would rollback last migration"
        return
    fi
    
    if ! confirm_action "This will rollback the last migration. This operation cannot be undone. Continue?"; then
        log_info "Rollback cancelled by user"
        exit 1
    fi
    
    # Get the last applied migration
    local last_migration
    last_migration=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1;" 2>/dev/null || echo "")
    
    if [[ -z "$last_migration" ]]; then
        log_error "No migrations found to rollback"
        exit 1
    fi
    
    log_info "Last migration: $last_migration"
    
    # Look for the most recent pre-migration backup
    local backup_dir="${PROJECT_ROOT}/backups/database"
    local latest_backup=""
    
    if [[ -d "$backup_dir" ]]; then
        latest_backup=$(find "$backup_dir" -name "pre_migration_*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2- || echo "")
    fi
    
    if [[ -z "$latest_backup" ]]; then
        log_error "No pre-migration backup found for rollback"
        log_error "Manual rollback required"
        exit 1
    fi
    
    log_info "Using backup for rollback: $latest_backup"
    
    # Restore from backup
    "${SCRIPT_DIR}/database-restore.sh" "$latest_backup" --force --no-rollback
    
    log_info "✅ Migration rollback completed"
}

# Show migration status
show_status() {
    log_info "Migration Status Report"
    echo "================================"
    
    local status_output
    status_output=$(get_migration_status 2>/dev/null || echo "")
    
    if [[ -z "$status_output" ]]; then
        echo "❌ Unable to determine migration status"
        return 1
    fi
    
    # Parse status output
    local applied_migrations
    applied_migrations=$(echo "$status_output" | sed -n '/APPLIED_MIGRATIONS<<EOF/,/^EOF$/p' | sed '1d;$d')
    
    local available_migrations
    available_migrations=$(echo "$status_output" | sed -n '/AVAILABLE_MIGRATIONS<<EOF/,/^EOF$/p' | sed '1d;$d')
    
    local pending_migrations
    pending_migrations=$(echo "$status_output" | sed -n '/PENDING_MIGRATIONS<<EOF/,/^EOF$/p' | sed '1d;$d')
    
    # Count migrations
    local applied_count=0
    local available_count=0
    local pending_count=0
    
    if [[ -n "$applied_migrations" ]]; then
        applied_count=$(echo "$applied_migrations" | wc -l)
    fi
    
    if [[ -n "$available_migrations" ]]; then
        available_count=$(echo "$available_migrations" | wc -l)
    fi
    
    if [[ -n "$pending_migrations" ]]; then
        pending_count=$(echo "$pending_migrations" | grep -v '^$' | wc -l || echo "0")
    fi
    
    echo "Environment: $ENVIRONMENT"
    echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
    echo ""
    echo "Migration Summary:"
    echo "  Available migrations: $available_count"
    echo "  Applied migrations:   $applied_count"
    echo "  Pending migrations:   $pending_count"
    echo ""
    
    if [[ $pending_count -gt 0 ]]; then
        echo "⚠️  Pending Migrations:"
        echo "$pending_migrations" | grep -v '^$' | while IFS= read -r migration; do
            if [[ -n "$migration" ]]; then
                echo "    • $migration"
            fi
        done
        echo ""
        echo "Run '$0 apply' to apply pending migrations"
    else
        echo "✅ Database is up to date"
    fi
    
    echo ""
    echo "Recent Applied Migrations:"
    if [[ -n "$applied_migrations" ]]; then
        echo "$applied_migrations" | tail -5 | while IFS= read -r migration; do
            if [[ -n "$migration" ]]; then
                echo "    ✓ $migration"
            fi
        done
    else
        echo "    (none)"
    fi
}

# Create new migration
create_migration() {
    log_info "Creating new migration..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create new migration using Prisma"
        return
    fi
    
    echo -n "Enter migration name (or press Enter for auto-generated): "
    read -r migration_name
    
    export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
    
    if [[ -n "$migration_name" ]]; then
        PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate dev --name "$migration_name" --create-only
    else
        PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate dev --create-only
    fi
    
    log_info "✅ New migration created"
}

# Reset database (DANGEROUS)
reset_database() {
    log_warning "⚠️  DATABASE RESET - This will destroy all data!"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_error "Database reset is not allowed in production environment"
        exit 1
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would reset database and apply all migrations"
        return
    fi
    
    if ! confirm_action "This will DELETE ALL DATA and reset the database. This cannot be undone. Continue?"; then
        log_info "Database reset cancelled by user"
        exit 1
    fi
    
    log_info "Resetting database..."
    
    export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
    
    if PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate reset --force; then
        log_info "✅ Database reset completed"
    else
        log_error "Database reset failed"
        exit 1
    fi
}

# Check for schema drift
check_schema_drift() {
    log_info "Checking for schema drift..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would check for schema drift"
        return
    fi
    
    export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
    
    # Generate Prisma client to detect schema changes
    if ! PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate &>/dev/null; then
        log_warning "Unable to generate Prisma client for drift detection"
        return
    fi
    
    # Run Prisma migrate status to detect drift
    local migrate_status
    migrate_status=$(PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate status 2>&1 || true)
    
    if echo "$migrate_status" | grep -q "database schema is not in sync"; then
        log_warning "⚠️  Schema drift detected!"
        echo "$migrate_status"
        echo ""
        echo "Consider running '$0 apply' to sync the schema"
    elif echo "$migrate_status" | grep -q "Database schema is up to date"; then
        log_info "✅ No schema drift detected"
    else
        log_info "Schema drift status: $migrate_status"
    fi
}

# Main command dispatcher
main() {
    log_info "Migration Manager - Command: $COMMAND, Environment: $ENVIRONMENT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN MODE - No actual changes will be made"
    fi
    
    # Common validation for most commands
    case "$COMMAND" in
        validate|apply|rollback|status|reset|drift)
            validate_environment
            test_database_connection
            ;;
        create)
            validate_environment
            ;;
    esac
    
    # Execute command
    case "$COMMAND" in
        validate)
            validate_migrations
            ;;
        apply)
            validate_migrations
            apply_migrations
            ;;
        rollback)
            rollback_migration
            ;;
        status)
            show_status
            ;;
        create)
            create_migration
            ;;
        reset)
            reset_database
            ;;
        drift)
            check_schema_drift
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            echo "Available commands: validate, apply, rollback, status, create, reset, drift"
            exit 1
            ;;
    esac
    
    log_info "Migration manager completed successfully"
}

# Error handling
trap 'log_error "Migration manager failed at line $LINENO"' ERR

# Execute main function
main "$@"