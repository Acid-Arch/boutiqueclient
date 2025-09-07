#!/bin/bash

# System Monitor for Boutique Client Portal
# Monitors system health and sends alerts when thresholds are exceeded

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/boutique-monitor.log"
ALERT_EMAIL="${ALERT_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Thresholds
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90
LOAD_THRESHOLD=4.0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] $level: $message" | tee -a "$LOG_FILE"
}

# Send alert function
send_alert() {
    local severity=$1
    local title=$2
    local message=$3
    
    log_message "ALERT" "$severity: $title - $message"
    
    # Send email if configured
    if [ -n "$ALERT_EMAIL" ]; then
        echo -e "Subject: [Boutique Portal] $severity: $title\n\n$message\n\nTimestamp: $(date)" | \
        sendmail "$ALERT_EMAIL" 2>/dev/null || log_message "ERROR" "Failed to send email alert"
    fi
    
    # Send Slack notification if configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        local color="#ff0000"  # Red for critical
        [ "$severity" = "WARNING" ] && color="#ffaa00"  # Orange for warning
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"title\":\"$title\",\"text\":\"$message\",\"footer\":\"Boutique Portal Monitor\"}]}" \
            "$SLACK_WEBHOOK" 2>/dev/null || log_message "ERROR" "Failed to send Slack alert"
    fi
}

# Check CPU usage
check_cpu() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    cpu_usage=${cpu_usage%.*}  # Remove decimal part
    
    log_message "INFO" "CPU usage: ${cpu_usage}%"
    
    if [ "$cpu_usage" -gt "$CPU_THRESHOLD" ]; then
        send_alert "CRITICAL" "High CPU Usage" "CPU usage is ${cpu_usage}% (threshold: ${CPU_THRESHOLD}%)"
        return 1
    fi
    
    return 0
}

# Check memory usage
check_memory() {
    local memory_info=$(free | grep Mem)
    local total_mem=$(echo $memory_info | awk '{print $2}')
    local used_mem=$(echo $memory_info | awk '{print $3}')
    local memory_percent=$((used_mem * 100 / total_mem))
    
    log_message "INFO" "Memory usage: ${memory_percent}% (${used_mem}/${total_mem})"
    
    if [ "$memory_percent" -gt "$MEMORY_THRESHOLD" ]; then
        send_alert "CRITICAL" "High Memory Usage" "Memory usage is ${memory_percent}% (threshold: ${MEMORY_THRESHOLD}%)"
        return 1
    fi
    
    return 0
}

# Check disk usage
check_disk() {
    local disk_usage=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    log_message "INFO" "Disk usage: ${disk_usage}%"
    
    if [ "$disk_usage" -gt "$DISK_THRESHOLD" ]; then
        send_alert "CRITICAL" "High Disk Usage" "Disk usage is ${disk_usage}% (threshold: ${DISK_THRESHOLD}%)"
        return 1
    fi
    
    return 0
}

# Check system load
check_load() {
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local load_comparison=$(echo "$load_avg > $LOAD_THRESHOLD" | bc -l)
    
    log_message "INFO" "Load average: $load_avg"
    
    if [ "$load_comparison" -eq 1 ]; then
        send_alert "WARNING" "High System Load" "Load average is $load_avg (threshold: $LOAD_THRESHOLD)"
        return 1
    fi
    
    return 0
}

# Check PM2 processes
check_pm2() {
    if ! command -v pm2 >/dev/null 2>&1; then
        log_message "WARNING" "PM2 not found"
        return 1
    fi
    
    local pm2_status=$(pm2 jlist 2>/dev/null)
    if [ -z "$pm2_status" ] || [ "$pm2_status" = "[]" ]; then
        send_alert "CRITICAL" "PM2 No Processes" "No PM2 processes running"
        return 1
    fi
    
    # Check specific processes
    local app_status=$(pm2 describe boutique-client-portal 2>/dev/null | grep -E "status.*online" | wc -l)
    local ws_status=$(pm2 describe boutique-websocket-server 2>/dev/null | grep -E "status.*online" | wc -l)
    
    if [ "$app_status" -eq 0 ]; then
        send_alert "CRITICAL" "Application Down" "Boutique Client Portal application is not running"
        return 1
    fi
    
    if [ "$ws_status" -eq 0 ]; then
        send_alert "WARNING" "WebSocket Down" "Boutique WebSocket server is not running"
        return 1
    fi
    
    log_message "INFO" "PM2 processes healthy: App(online) WS(online)"
    return 0
}

# Check database connectivity
check_database() {
    if [ -f "$PROJECT_ROOT/.env.production" ]; then
        source "$PROJECT_ROOT/.env.production"
    elif [ -f "$PROJECT_ROOT/.env" ]; then
        source "$PROJECT_ROOT/.env"
    else
        log_message "WARNING" "No environment file found for database check"
        return 1
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        log_message "WARNING" "DATABASE_URL not configured"
        return 1
    fi
    
    # Extract database connection details
    if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/([^?]+) ]]; then
        local db_user="${BASH_REMATCH[1]}"
        local db_password="${BASH_REMATCH[2]}"
        local db_host="${BASH_REMATCH[3]}"
        local db_port="${BASH_REMATCH[4]}"
        local db_name="${BASH_REMATCH[5]}"
        
        # Test database connection
        if PGPASSWORD="$db_password" timeout 10 psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1;" >/dev/null 2>&1; then
            log_message "INFO" "Database connectivity: OK"
            return 0
        else
            send_alert "CRITICAL" "Database Connection Failed" "Cannot connect to database at $db_host:$db_port"
            return 1
        fi
    else
        log_message "WARNING" "Invalid DATABASE_URL format"
        return 1
    fi
}

# Check application health endpoint
check_app_health() {
    local health_url="http://localhost:3000/api/admin/health"
    
    if command -v curl >/dev/null 2>&1; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$health_url")
        
        if [ "$response" = "200" ]; then
            log_message "INFO" "Application health check: OK"
            return 0
        else
            send_alert "CRITICAL" "Health Check Failed" "Application health endpoint returned HTTP $response"
            return 1
        fi
    else
        log_message "WARNING" "curl not available for health check"
        return 1
    fi
}

# Check SSL certificate expiration
check_ssl_cert() {
    local domain="$1"
    if [ -z "$domain" ]; then
        log_message "INFO" "SSL check skipped (no domain provided)"
        return 0
    fi
    
    if [ ! -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]; then
        log_message "INFO" "SSL certificate not found for $domain"
        return 0
    fi
    
    local cert_expiry=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$domain/fullchain.pem" | cut -d= -f2)
    local expiry_timestamp=$(date -d "$cert_expiry" +%s)
    local current_timestamp=$(date +%s)
    local days_until_expiry=$(((expiry_timestamp - current_timestamp) / 86400))
    
    log_message "INFO" "SSL certificate expires in $days_until_expiry days"
    
    if [ "$days_until_expiry" -lt 30 ]; then
        local severity="CRITICAL"
        [ "$days_until_expiry" -gt 7 ] && severity="WARNING"
        
        send_alert "$severity" "SSL Certificate Expiring" "Certificate for $domain expires in $days_until_expiry days"
        return 1
    fi
    
    return 0
}

# Main monitoring function
run_monitor() {
    log_message "INFO" "Starting system health check"
    
    local issues=0
    
    check_cpu || ((issues++))
    check_memory || ((issues++))
    check_disk || ((issues++))
    check_load || ((issues++))
    check_pm2 || ((issues++))
    check_database || ((issues++))
    check_app_health || ((issues++))
    
    # Check SSL if domain is configured
    if [ -n "${PUBLIC_APP_URL:-}" ]; then
        local domain=$(echo "$PUBLIC_APP_URL" | sed -E 's|https?://([^/]+).*|\1|')
        check_ssl_cert "$domain" || ((issues++))
    fi
    
    if [ $issues -eq 0 ]; then
        log_message "INFO" "All health checks passed"
    else
        log_message "WARNING" "$issues health check(s) failed"
    fi
    
    log_message "INFO" "Health check completed"
    return $issues
}

# Generate summary report
generate_summary() {
    log_message "INFO" "System Summary:"
    log_message "INFO" "  Uptime: $(uptime -p)"
    log_message "INFO" "  Load: $(uptime | awk -F'load average:' '{print $2}')"
    log_message "INFO" "  Memory: $(free -h | grep Mem | awk '{print $3"/"$2}')"
    log_message "INFO" "  Disk: $(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $3"/"$2" ("$5" used)"}')"
    
    if command -v pm2 >/dev/null 2>&1; then
        log_message "INFO" "  PM2 processes: $(pm2 jlist 2>/dev/null | jq length 2>/dev/null || echo "N/A")"
    fi
}

# Help function
show_help() {
    cat << EOF
Boutique Portal System Monitor

Usage: $0 [OPTIONS]

Options:
    --check-only    Run checks without sending alerts
    --summary       Show system summary
    --help          Show this help message

Environment Variables:
    ALERT_EMAIL     Email address for alerts
    SLACK_WEBHOOK   Slack webhook URL for notifications
    CPU_THRESHOLD   CPU usage threshold (default: 80)
    MEMORY_THRESHOLD Memory usage threshold (default: 85)
    DISK_THRESHOLD  Disk usage threshold (default: 90)
    LOAD_THRESHOLD  Load average threshold (default: 4.0)

Examples:
    $0                  # Run full monitoring with alerts
    $0 --summary        # Show system summary only
    $0 --check-only     # Run checks without alerts

EOF
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --summary)
        generate_summary
        exit 0
        ;;
    --check-only)
        # Override alert functions to only log
        send_alert() {
            log_message "CHECK" "$1: $2 - $3"
        }
        run_monitor
        exit $?
        ;;
    "")
        run_monitor
        exit $?
        ;;
    *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
esac