#!/bin/bash

# =============================================================================
# Production Monitoring Setup Script for Boutique Client Portal
# =============================================================================
#
# This script sets up comprehensive monitoring and alerting for production
# Includes: log monitoring, system metrics, application health checks, alerts
#
# Usage:
#   ./setup-monitoring.sh [options]
#
# Options:
#   --email=<email>                 Alert notification email
#   --slack-webhook=<url>           Slack webhook for alerts
#   --check-interval=<seconds>      Health check interval (default: 60)
#   --enable-metrics                Enable system metrics collection
#   --install-dependencies          Install monitoring dependencies
#   --dry-run                       Test configuration without applying
#
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default configuration
DEFAULT_CHECK_INTERVAL=60
DEFAULT_EMAIL=""
DEFAULT_SLACK_WEBHOOK=""
DEFAULT_ENABLE_METRICS=true

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

confirm() {
    local prompt="$1"
    local response
    read -p "$(echo -e "${YELLOW}$prompt [y/N]:${NC} ")" response
    [[ "$response" =~ ^[Yy]$ ]]
}

# =============================================================================
# Configuration Parsing
# =============================================================================

parse_args() {
    CHECK_INTERVAL="$DEFAULT_CHECK_INTERVAL"
    EMAIL="$DEFAULT_EMAIL"
    SLACK_WEBHOOK="$DEFAULT_SLACK_WEBHOOK"
    ENABLE_METRICS="$DEFAULT_ENABLE_METRICS"
    INSTALL_DEPS=false
    DRY_RUN=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --email=*)
                EMAIL="${1#*=}"
                shift
                ;;
            --slack-webhook=*)
                SLACK_WEBHOOK="${1#*=}"
                shift
                ;;
            --check-interval=*)
                CHECK_INTERVAL="${1#*=}"
                shift
                ;;
            --enable-metrics)
                ENABLE_METRICS=true
                shift
                ;;
            --disable-metrics)
                ENABLE_METRICS=false
                shift
                ;;
            --install-dependencies)
                INSTALL_DEPS=true
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
}

show_help() {
    cat << EOF
Production Monitoring Setup Script for Boutique Client Portal

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --email=<email>                 Email for alert notifications
    --slack-webhook=<url>           Slack webhook URL for alerts
    --check-interval=<seconds>      Health check interval (default: 60)
    --enable-metrics                Enable system metrics collection
    --disable-metrics               Disable system metrics collection
    --install-dependencies          Install monitoring dependencies
    --dry-run                       Test configuration without applying
    -h, --help                      Show this help

EXAMPLES:
    # Basic monitoring setup
    $0 --email=admin@example.com

    # Full monitoring with Slack alerts
    $0 --email=admin@example.com --slack-webhook=https://hooks.slack.com/...

    # Quick health checks
    $0 --check-interval=30 --disable-metrics
EOF
}

# =============================================================================
# System Prerequisites
# =============================================================================

install_dependencies() {
    if [[ "$INSTALL_DEPS" != "true" ]]; then
        return 0
    fi

    log "Installing monitoring dependencies..."

    # Update package lists
    if command -v apt-get &> /dev/null; then
        apt-get update
        # Install monitoring tools
        apt-get install -y htop iotop nethogs vnstat curl jq bc sysstat
        systemctl enable sysstat
    elif command -v yum &> /dev/null; then
        yum update -y
        yum install -y htop iotop nethogs vnstat curl jq bc sysstat
        systemctl enable sysstat
    elif command -v dnf &> /dev/null; then
        dnf update -y
        dnf install -y htop iotop nethogs vnstat curl jq bc sysstat
        systemctl enable sysstat
    else
        warning "Package manager not supported for automatic dependency installation"
    fi

    success "Monitoring dependencies installed"
}

# =============================================================================
# Log Monitoring Setup
# =============================================================================

setup_log_monitoring() {
    log "Setting up log monitoring..."

    # Create log monitoring directory
    mkdir -p "$PROJECT_ROOT/monitoring/logs"
    mkdir -p "$PROJECT_ROOT/logs"

    # Create log analysis script
    cat > "$PROJECT_ROOT/monitoring/logs/analyze-logs.sh" << 'EOF'
#!/bin/bash

# Log Analysis Script for Boutique Client Portal
# Analyzes application logs for errors, warnings, and patterns

LOG_DIR="/opt/boutique-client/logs"
REPORT_FILE="/opt/boutique-client/monitoring/logs/log-analysis-$(date +%Y%m%d-%H%M%S).txt"

echo "=== Log Analysis Report ===" > "$REPORT_FILE"
echo "Generated: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Error analysis
echo "=== ERROR ANALYSIS ===" >> "$REPORT_FILE"
if [ -f "$LOG_DIR/error.log" ]; then
    ERROR_COUNT=$(grep -c "ERROR\|FATAL\|CRITICAL" "$LOG_DIR/error.log" 2>/dev/null || echo "0")
    echo "Total errors in last log: $ERROR_COUNT" >> "$REPORT_FILE"
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "Recent errors:" >> "$REPORT_FILE"
        tail -20 "$LOG_DIR/error.log" | grep -E "ERROR|FATAL|CRITICAL" >> "$REPORT_FILE"
    fi
else
    echo "Error log not found" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# Performance analysis
echo "=== PERFORMANCE ANALYSIS ===" >> "$REPORT_FILE"
if [ -f "$LOG_DIR/out.log" ]; then
    SLOW_QUERIES=$(grep -c "slow query\|timeout\|taking too long" "$LOG_DIR/out.log" 2>/dev/null || echo "0")
    echo "Slow queries/timeouts: $SLOW_QUERIES" >> "$REPORT_FILE"
    
    MEMORY_WARNINGS=$(grep -c "memory\|heap\|GC" "$LOG_DIR/out.log" 2>/dev/null || echo "0")
    echo "Memory-related messages: $MEMORY_WARNINGS" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# Security analysis
echo "=== SECURITY ANALYSIS ===" >> "$REPORT_FILE"
if [ -f "$LOG_DIR/combined.log" ]; then
    FAILED_LOGINS=$(grep -c "authentication failed\|login failed\|invalid credentials" "$LOG_DIR/combined.log" 2>/dev/null || echo "0")
    echo "Failed login attempts: $FAILED_LOGINS" >> "$REPORT_FILE"
    
    RATE_LIMITS=$(grep -c "rate limit\|too many requests\|429" "$LOG_DIR/combined.log" 2>/dev/null || echo "0")
    echo "Rate limit violations: $RATE_LIMITS" >> "$REPORT_FILE"
fi

# Output summary to stdout for cron
echo "Log analysis complete. Report: $REPORT_FILE"
if [ "$ERROR_COUNT" -gt 10 ]; then
    echo "WARNING: High error count detected ($ERROR_COUNT)"
    exit 1
fi
EOF

    chmod +x "$PROJECT_ROOT/monitoring/logs/analyze-logs.sh"

    # Create log alert script
    cat > "$PROJECT_ROOT/monitoring/logs/log-alerts.sh" << EOF
#!/bin/bash

# Log Alert Script - sends notifications for critical log events

LOG_DIR="/opt/boutique-client/logs"
EMAIL="$EMAIL"
SLACK_WEBHOOK="$SLACK_WEBHOOK"

send_email_alert() {
    local subject="\$1"
    local message="\$2"
    
    if [ -n "\$EMAIL" ] && command -v mail &> /dev/null; then
        echo "\$message" | mail -s "\$subject" "\$EMAIL"
    fi
}

send_slack_alert() {
    local message="\$1"
    
    if [ -n "\$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \\
            --data "{\"text\":\"🚨 Boutique Portal Alert: \$message\"}" \\
            "\$SLACK_WEBHOOK" &> /dev/null
    fi
}

# Check for critical errors in the last 5 minutes
if [ -f "\$LOG_DIR/error.log" ]; then
    RECENT_ERRORS=\$(find "\$LOG_DIR/error.log" -mmin -5 -exec grep -c "FATAL\|CRITICAL" {} \\; 2>/dev/null || echo "0")
    
    if [ "\$RECENT_ERRORS" -gt 0 ]; then
        MESSAGE="Critical errors detected in application logs (\$RECENT_ERRORS errors)"
        send_email_alert "Boutique Portal Critical Error Alert" "\$MESSAGE"
        send_slack_alert "\$MESSAGE"
    fi
fi

# Check for high memory usage
MEMORY_USAGE=\$(free | grep Mem | awk '{printf("%.1f", \$3/\$2 * 100.0)}')
if (( \$(echo "\$MEMORY_USAGE > 90" | bc -l) )); then
    MESSAGE="High memory usage detected: \${MEMORY_USAGE}%"
    send_email_alert "Boutique Portal Memory Alert" "\$MESSAGE"
    send_slack_alert "\$MESSAGE"
fi

# Check if application is responding
if ! curl -sf http://localhost:3000/health &> /dev/null; then
    MESSAGE="Application health check failed - service may be down"
    send_email_alert "Boutique Portal Service Alert" "\$MESSAGE"
    send_slack_alert "\$MESSAGE"
fi
EOF

    chmod +x "$PROJECT_ROOT/monitoring/logs/log-alerts.sh"

    success "Log monitoring scripts created"
}

# =============================================================================
# Health Check Setup
# =============================================================================

setup_health_checks() {
    log "Setting up health check monitoring..."

    mkdir -p "$PROJECT_ROOT/monitoring/health"

    # Create comprehensive health check script
    cat > "$PROJECT_ROOT/monitoring/health/health-monitor.sh" << EOF
#!/bin/bash

# Comprehensive Health Check Script for Boutique Client Portal

APP_URL="http://localhost:3000"
WS_URL="ws://localhost:8081"
DB_CHECK_TIMEOUT=5
REPORT_FILE="/opt/boutique-client/monitoring/health/health-status.json"

# Initialize status object
STATUS_JSON="{
    \"timestamp\": \"\$(date -Iseconds)\",
    \"overall_status\": \"unknown\",
    \"checks\": {}
}"

# Function to update status
update_status() {
    local component="\$1"
    local status="\$2"
    local message="\$3"
    local response_time="\${4:-0}"
    
    STATUS_JSON=\$(echo "\$STATUS_JSON" | jq \\
        --arg comp "\$component" \\
        --arg stat "\$status" \\
        --arg msg "\$message" \\
        --argjson time "\$response_time" \\
        '.checks[\$comp] = {\"status\": \$stat, \"message\": \$msg, \"response_time_ms\": \$time}')
}

# Check application HTTP health
check_app_health() {
    local start_time=\$(date +%s%N)
    if curl -sf "\$APP_URL/health" &> /dev/null; then
        local end_time=\$(date +%s%N)
        local response_time=\$(( (\$end_time - \$start_time) / 1000000 ))
        update_status "application" "healthy" "Application responding" \$response_time
    else
        update_status "application" "unhealthy" "Application not responding" 0
    fi
}

# Check database connectivity
check_database() {
    if timeout \$DB_CHECK_TIMEOUT curl -sf "\$APP_URL/api/admin/health" | jq -e '.database == true' &> /dev/null; then
        update_status "database" "healthy" "Database connection successful" 0
    else
        update_status "database" "unhealthy" "Database connection failed" 0
    fi
}

# Check WebSocket server
check_websocket() {
    # Simple WebSocket connection test (requires websocat or similar)
    if command -v nc &> /dev/null; then
        if timeout 3 nc -z localhost 8081 &> /dev/null; then
            update_status "websocket" "healthy" "WebSocket port open" 0
        else
            update_status "websocket" "unhealthy" "WebSocket port not accessible" 0
        fi
    else
        update_status "websocket" "unknown" "WebSocket check tool not available" 0
    fi
}

# Check system resources
check_system_resources() {
    local cpu_usage=\$(top -bn1 | grep "Cpu(s)" | awk '{print \$2}' | sed 's/%us,//')
    local memory_usage=\$(free | grep Mem | awk '{printf "%.1f", \$3/\$2 * 100.0}')
    local disk_usage=\$(df / | tail -1 | awk '{print \$5}' | sed 's/%//')
    
    if (( \$(echo "\$memory_usage < 90" | bc -l) )) && [ "\$disk_usage" -lt 90 ]; then
        update_status "system_resources" "healthy" "CPU: \${cpu_usage}%, Memory: \${memory_usage}%, Disk: \${disk_usage}%" 0
    else
        update_status "system_resources" "warning" "High resource usage - CPU: \${cpu_usage}%, Memory: \${memory_usage}%, Disk: \${disk_usage}%" 0
    fi
}

# Check SSL certificate (if HTTPS is configured)
check_ssl_certificate() {
    if [ -f "/etc/letsencrypt/live/*/fullchain.pem" ]; then
        local cert_file=\$(ls /etc/letsencrypt/live/*/fullchain.pem | head -1)
        local days_until_expiry=\$(openssl x509 -in "\$cert_file" -checkend \$(( 30 * 24 * 3600 )) &> /dev/null && echo "30+" || echo "< 30")
        
        if [ "\$days_until_expiry" == "30+" ]; then
            update_status "ssl_certificate" "healthy" "SSL certificate valid for 30+ days" 0
        else
            update_status "ssl_certificate" "warning" "SSL certificate expires in less than 30 days" 0
        fi
    else
        update_status "ssl_certificate" "unknown" "No SSL certificate found" 0
    fi
}

# Perform all checks
check_app_health
check_database
check_websocket
check_system_resources
check_ssl_certificate

# Determine overall status
UNHEALTHY_COUNT=\$(echo "\$STATUS_JSON" | jq '[.checks[] | select(.status == "unhealthy")] | length')
WARNING_COUNT=\$(echo "\$STATUS_JSON" | jq '[.checks[] | select(.status == "warning")] | length')

if [ "\$UNHEALTHY_COUNT" -gt 0 ]; then
    OVERALL_STATUS="unhealthy"
elif [ "\$WARNING_COUNT" -gt 0 ]; then
    OVERALL_STATUS="warning"
else
    OVERALL_STATUS="healthy"
fi

# Update overall status
STATUS_JSON=\$(echo "\$STATUS_JSON" | jq --arg status "\$OVERALL_STATUS" '.overall_status = \$status')

# Save status report
echo "\$STATUS_JSON" > "\$REPORT_FILE"

# Output for monitoring
echo "Health check complete. Overall status: \$OVERALL_STATUS"
if [ "\$OVERALL_STATUS" != "healthy" ]; then
    echo "\$STATUS_JSON" | jq -r '.checks[] | select(.status != "healthy") | "- " + .message'
    exit 1
fi
EOF

    chmod +x "$PROJECT_ROOT/monitoring/health/health-monitor.sh"

    success "Health check monitoring configured"
}

# =============================================================================
# System Metrics Collection
# =============================================================================

setup_metrics_collection() {
    if [[ "$ENABLE_METRICS" != "true" ]]; then
        log "Skipping metrics collection setup"
        return 0
    fi

    log "Setting up system metrics collection..."

    mkdir -p "$PROJECT_ROOT/monitoring/metrics"

    # Create metrics collection script
    cat > "$PROJECT_ROOT/monitoring/metrics/collect-metrics.sh" << 'EOF'
#!/bin/bash

# System Metrics Collection Script for Boutique Client Portal

METRICS_DIR="/opt/boutique-client/monitoring/metrics"
TIMESTAMP=$(date +%s)
DATE=$(date +%Y-%m-%d)

# Create daily metrics file
METRICS_FILE="$METRICS_DIR/metrics-$DATE.json"

# Collect system metrics
collect_system_metrics() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    local memory_total=$(free -m | grep Mem | awk '{print $2}')
    local memory_used=$(free -m | grep Mem | awk '{print $3}')
    local memory_available=$(free -m | grep Mem | awk '{print $7}')
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | sed 's/^ *//')
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    echo "{
        \"timestamp\": $TIMESTAMP,
        \"system\": {
            \"cpu_usage_percent\": \"$cpu_usage\",
            \"memory_total_mb\": $memory_total,
            \"memory_used_mb\": $memory_used,
            \"memory_available_mb\": $memory_available,
            \"load_average\": \"$load_avg\",
            \"disk_usage_percent\": $disk_usage
        }
    }" | jq '.'
}

# Collect application metrics
collect_app_metrics() {
    local app_response_time=0
    local app_status="unknown"
    
    # Test application response time
    if command -v curl &> /dev/null; then
        local start_time=$(date +%s%N)
        if curl -sf http://localhost:3000/health &> /dev/null; then
            local end_time=$(date +%s%N)
            app_response_time=$(( ($end_time - $start_time) / 1000000 ))
            app_status="healthy"
        else
            app_status="unhealthy"
        fi
    fi
    
    echo "{
        \"timestamp\": $TIMESTAMP,
        \"application\": {
            \"status\": \"$app_status\",
            \"response_time_ms\": $app_response_time,
            \"uptime_seconds\": $(cat /proc/uptime | awk '{print int($1)}')
        }
    }" | jq '.'
}

# Collect network metrics
collect_network_metrics() {
    local connections=$(netstat -an | wc -l)
    local listening_ports=$(netstat -tuln | grep LISTEN | wc -l)
    
    echo "{
        \"timestamp\": $TIMESTAMP,
        \"network\": {
            \"total_connections\": $connections,
            \"listening_ports\": $listening_ports
        }
    }" | jq '.'
}

# Combine all metrics
SYSTEM_METRICS=$(collect_system_metrics)
APP_METRICS=$(collect_app_metrics)
NETWORK_METRICS=$(collect_network_metrics)

# Merge metrics into single JSON
COMBINED_METRICS=$(echo "$SYSTEM_METRICS $APP_METRICS $NETWORK_METRICS" | jq -s 'add')

# Append to daily metrics file
if [ -f "$METRICS_FILE" ]; then
    # Append to existing file
    jq --argjson new "$COMBINED_METRICS" '. += [$new]' "$METRICS_FILE" > "$METRICS_FILE.tmp" && mv "$METRICS_FILE.tmp" "$METRICS_FILE"
else
    # Create new file
    echo "[$COMBINED_METRICS]" > "$METRICS_FILE"
fi

# Cleanup old metrics (keep 30 days)
find "$METRICS_DIR" -name "metrics-*.json" -mtime +30 -delete 2>/dev/null || true

echo "Metrics collected and saved to $METRICS_FILE"
EOF

    chmod +x "$PROJECT_ROOT/monitoring/metrics/collect-metrics.sh"

    success "Metrics collection configured"
}

# =============================================================================
# Cron Job Setup
# =============================================================================

setup_cron_jobs() {
    log "Setting up monitoring cron jobs..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create cron jobs"
        return 0
    fi

    # Create temporary cron file
    TEMP_CRON=$(mktemp)
    
    # Get existing cron jobs (excluding our monitoring jobs)
    crontab -l 2>/dev/null | grep -v "boutique-client monitoring" > "$TEMP_CRON" || true

    # Add monitoring cron jobs
    cat >> "$TEMP_CRON" << EOF

# Boutique Client Portal monitoring jobs
# Health checks every $CHECK_INTERVAL seconds
*/$((CHECK_INTERVAL/60)) * * * * /opt/boutique-client/monitoring/health/health-monitor.sh # boutique-client monitoring

# Log alerts every 5 minutes
*/5 * * * * /opt/boutique-client/monitoring/logs/log-alerts.sh # boutique-client monitoring

# Daily log analysis at 2 AM
0 2 * * * /opt/boutique-client/monitoring/logs/analyze-logs.sh # boutique-client monitoring

EOF

    # Add metrics collection if enabled
    if [[ "$ENABLE_METRICS" == "true" ]]; then
        cat >> "$TEMP_CRON" << EOF
# Metrics collection every 5 minutes
*/5 * * * * /opt/boutique-client/monitoring/metrics/collect-metrics.sh # boutique-client monitoring

EOF
    fi

    # Install cron jobs
    crontab "$TEMP_CRON"
    rm "$TEMP_CRON"

    success "Monitoring cron jobs configured"
}

# =============================================================================
# Main Monitoring Setup Flow
# =============================================================================

main() {
    log "Starting production monitoring setup for Boutique Client Portal..."
    log "Check interval: ${CHECK_INTERVAL}s"
    log "Metrics enabled: $ENABLE_METRICS"
    log "Email alerts: ${EMAIL:-"None"}"
    log "Slack alerts: ${SLACK_WEBHOOK:+"Configured"}${SLACK_WEBHOOK:-"None"}"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN MODE - No changes will be made"
    fi

    install_dependencies
    setup_log_monitoring
    setup_health_checks
    setup_metrics_collection
    setup_cron_jobs

    success "Production monitoring setup completed successfully!"
    
    echo
    echo "=== Monitoring Configuration Summary ==="
    echo "📊 Health checks: Every $((CHECK_INTERVAL/60)) minutes"
    echo "🚨 Log alerts: Every 5 minutes"  
    echo "📈 Metrics collection: ${ENABLE_METRICS:+"Every 5 minutes"}${ENABLE_METRICS:-"Disabled"}"
    echo "📧 Email notifications: ${EMAIL:-"None configured"}"
    echo "💬 Slack notifications: ${SLACK_WEBHOOK:+"Configured"}${SLACK_WEBHOOK:-"None configured"}"
    echo
    echo "=== Monitoring Files ==="
    echo "📁 Monitoring directory: $PROJECT_ROOT/monitoring/"
    echo "🔍 Health status: $PROJECT_ROOT/monitoring/health/health-status.json"
    echo "📊 Metrics: $PROJECT_ROOT/monitoring/metrics/"
    echo "📝 Log analysis: $PROJECT_ROOT/monitoring/logs/"
    echo
    echo "=== Manual Commands ==="
    echo "🔍 Check health: $PROJECT_ROOT/monitoring/health/health-monitor.sh"
    echo "📊 Collect metrics: $PROJECT_ROOT/monitoring/metrics/collect-metrics.sh"
    echo "📝 Analyze logs: $PROJECT_ROOT/monitoring/logs/analyze-logs.sh"
    echo "🚨 Test alerts: $PROJECT_ROOT/monitoring/logs/log-alerts.sh"
    echo
}

# =============================================================================
# Script Execution
# =============================================================================

# Trap errors
trap 'error "Monitoring setup failed at line $LINENO"' ERR

# Parse arguments and run main function
parse_args "$@"
main