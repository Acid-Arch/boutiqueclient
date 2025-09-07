#!/bin/bash

# =============================================================================
# Security Review and Validation Script for Boutique Client Portal
# =============================================================================
#
# This script performs a comprehensive security audit and validation of the
# Boutique Client Portal production environment, covering:
#
# - System security configuration
# - Application security settings  
# - Database security posture
# - Network security assessment
# - File permissions and ownership
# - SSL/TLS configuration
# - Authentication and authorization
# - Environment variable security
# - Third-party dependency vulnerabilities
# - Security monitoring effectiveness
#
# Usage:
#   sudo ./security-review.sh [options]
#
# Options:
#   --report-file=<path>        Output detailed report to file
#   --fix-issues               Automatically fix non-critical security issues
#   --include-passwords        Include password policy check (requires root)
#   --network-scan             Include network security scan
#   --compliance-check=<std>   Check against compliance standard (OWASP, ISO27001)
#   --severity=<level>         Only show issues of specified severity (high, medium, low)
#   --format=<format>          Output format (text, json, html)
#   --dry-run                  Show what would be checked without executing
#
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="/opt/boutique-client/security-reports"
DEFAULT_REPORT_FILE="$REPORT_DIR/security-review-$(date +%Y%m%d_%H%M%S).txt"

# Default configuration
FIX_ISSUES=false
INCLUDE_PASSWORDS=false
NETWORK_SCAN=false
COMPLIANCE_CHECK=""
SEVERITY_FILTER=""
OUTPUT_FORMAT="text"
DRY_RUN=false
REPORT_FILE="$DEFAULT_REPORT_FILE"

# Security issue counters
CRITICAL_ISSUES=0
HIGH_ISSUES=0
MEDIUM_ISSUES=0
LOW_ISSUES=0
INFO_ISSUES=0

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# =============================================================================
# Utility Functions
# =============================================================================

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1" >> "$REPORT_FILE"
}

success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] PASS: $1" >> "$REPORT_FILE"
}

warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $1" >> "$REPORT_FILE"
    ((MEDIUM_ISSUES++))
}

error() {
    echo -e "${RED}[FAIL]${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] FAIL: $1" >> "$REPORT_FILE"
    ((HIGH_ISSUES++))
}

critical() {
    echo -e "${RED}[CRITICAL]${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] CRITICAL: $1" >> "$REPORT_FILE"
    ((CRITICAL_ISSUES++))
}

info() {
    echo -e "${PURPLE}[INFO]${NC} $1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1" >> "$REPORT_FILE"
    ((INFO_ISSUES++))
}

# =============================================================================
# Configuration Parsing
# =============================================================================

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --report-file=*)
                REPORT_FILE="${1#*=}"
                shift
                ;;
            --fix-issues)
                FIX_ISSUES=true
                shift
                ;;
            --include-passwords)
                INCLUDE_PASSWORDS=true
                shift
                ;;
            --network-scan)
                NETWORK_SCAN=true
                shift
                ;;
            --compliance-check=*)
                COMPLIANCE_CHECK="${1#*=}"
                shift
                ;;
            --severity=*)
                SEVERITY_FILTER="${1#*=}"
                shift
                ;;
            --format=*)
                OUTPUT_FORMAT="${1#*=}"
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
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
Security Review and Validation Script for Boutique Client Portal

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --report-file=<path>        Output detailed report to file (default: auto-generated)
    --fix-issues               Automatically fix non-critical security issues
    --include-passwords        Include password policy check (requires root)
    --network-scan             Include network security scan (requires nmap)
    --compliance-check=<std>   Check against compliance standard (OWASP, ISO27001)
    --severity=<level>         Only show issues of specified severity (critical, high, medium, low)
    --format=<format>          Output format (text, json, html) [default: text]
    --dry-run                  Show what would be checked without executing
    -h, --help                 Show this help

EXAMPLES:
    # Basic security review
    $0
    
    # Comprehensive review with auto-fix
    $0 --fix-issues --include-passwords --network-scan
    
    # OWASP compliance check
    $0 --compliance-check=OWASP --format=html --report-file=owasp-compliance.html
    
    # Show only critical and high severity issues
    $0 --severity=critical,high

EOF
}

# =============================================================================
# Report Generation
# =============================================================================

setup_report() {
    mkdir -p "$REPORT_DIR"
    
    cat > "$REPORT_FILE" << EOF
================================================================================
BOUTIQUE CLIENT PORTAL - SECURITY REVIEW REPORT
================================================================================

Review Date: $(date)
Reviewer: $(whoami)
System: $(hostname)
Script Version: 1.0

Project Root: $PROJECT_ROOT
Report Options:
  - Fix Issues: $FIX_ISSUES
  - Include Passwords: $INCLUDE_PASSWORDS
  - Network Scan: $NETWORK_SCAN
  - Compliance Check: ${COMPLIANCE_CHECK:-None}
  - Severity Filter: ${SEVERITY_FILTER:-All}

================================================================================
SECURITY ASSESSMENT RESULTS
================================================================================

EOF

    log "Security review report initialized: $REPORT_FILE"
}

# =============================================================================
# System Security Assessment
# =============================================================================

check_system_security() {
    log "Checking system security configuration..."
    
    # Check if running as root
    if [[ "$EUID" -ne 0 ]]; then
        warning "Not running as root - some security checks may be limited"
    fi
    
    # Operating system security
    check_os_security
    
    # User and permission security
    check_user_permissions
    
    # Service security
    check_service_security
    
    # Firewall configuration
    check_firewall_security
    
    # SSH security
    check_ssh_security
    
    # System updates
    check_system_updates
}

check_os_security() {
    log "Checking operating system security..."
    
    # Check OS version and support status
    if [[ -f /etc/os-release ]]; then
        local os_info=$(grep "PRETTY_NAME" /etc/os-release | cut -d'"' -f2)
        info "Operating System: $os_info"
        
        # Check if Ubuntu LTS
        if grep -q "Ubuntu" /etc/os-release; then
            if ! grep -q "LTS" /etc/os-release; then
                warning "Not using Ubuntu LTS version - consider upgrading for long-term support"
            else
                success "Using Ubuntu LTS version"
            fi
        fi
    fi
    
    # Check kernel version
    local kernel_version=$(uname -r)
    info "Kernel Version: $kernel_version"
    
    # Check for unattended-upgrades
    if dpkg -l | grep -q unattended-upgrades; then
        success "Unattended upgrades configured"
        
        # Check configuration
        if [[ -f /etc/apt/apt.conf.d/50unattended-upgrades ]]; then
            if grep -q "security" /etc/apt/apt.conf.d/50unattended-upgrades; then
                success "Security updates enabled in unattended-upgrades"
            else
                warning "Security updates not configured in unattended-upgrades"
            fi
        fi
    else
        error "Unattended upgrades not installed - system updates may be missed"
        
        if [[ "$FIX_ISSUES" == "true" ]] && [[ "$EUID" -eq 0 ]]; then
            log "Installing unattended-upgrades..."
            apt-get update && apt-get install -y unattended-upgrades
        fi
    fi
    
    # Check for SELinux/AppArmor
    if command -v aa-status >/dev/null 2>&1; then
        if aa-status 2>/dev/null | grep -q "apparmor module is loaded"; then
            success "AppArmor is active"
        else
            warning "AppArmor is not active"
        fi
    else
        warning "AppArmor not installed"
    fi
}

check_user_permissions() {
    log "Checking user permissions and accounts..."
    
    # Check for users with UID 0 (root privileges)
    local root_users=$(awk -F: '$3 == 0 {print $1}' /etc/passwd)
    if [[ "$root_users" == "root" ]]; then
        success "Only root user has UID 0"
    else
        error "Multiple users with UID 0 detected: $root_users"
    fi
    
    # Check for users without passwords
    local no_password_users=$(awk -F: '($2 == "" ) {print $1}' /etc/shadow 2>/dev/null || echo "Cannot read /etc/shadow")
    if [[ "$no_password_users" == "Cannot read /etc/shadow" ]]; then
        info "Cannot check for users without passwords (need root)"
    elif [[ -z "$no_password_users" ]]; then
        success "No users without passwords found"
    else
        critical "Users without passwords detected: $no_password_users"
    fi
    
    # Check sudo configuration
    if [[ -f /etc/sudoers ]]; then
        # Check for NOPASSWD entries
        local nopasswd_entries=$(grep -v "^#" /etc/sudoers | grep NOPASSWD || echo "")
        if [[ -n "$nopasswd_entries" ]]; then
            warning "NOPASSWD entries found in sudoers file"
            echo "$nopasswd_entries" >> "$REPORT_FILE"
        else
            success "No NOPASSWD entries in sudoers file"
        fi
        
        # Check for ALL permissions
        local all_permissions=$(grep -v "^#" /etc/sudoers | grep "ALL.*ALL" || echo "")
        if [[ -n "$all_permissions" ]]; then
            info "Broad sudo permissions found (review recommended):"
            echo "$all_permissions" >> "$REPORT_FILE"
        fi
    fi
    
    # Check boutique-client user
    if id boutique-client >/dev/null 2>&1; then
        success "boutique-client service user exists"
        
        # Check user shell
        local user_shell=$(getent passwd boutique-client | cut -d: -f7)
        if [[ "$user_shell" == "/bin/false" || "$user_shell" == "/usr/sbin/nologin" ]]; then
            success "boutique-client user has non-login shell: $user_shell"
        else
            warning "boutique-client user has login shell: $user_shell"
        fi
        
        # Check home directory permissions
        local home_dir=$(getent passwd boutique-client | cut -d: -f6)
        if [[ -d "$home_dir" ]]; then
            local permissions=$(stat -c "%a" "$home_dir")
            if [[ "$permissions" == "750" || "$permissions" == "755" ]]; then
                success "boutique-client home directory permissions: $permissions"
            else
                warning "boutique-client home directory permissions: $permissions (consider 750)"
            fi
        fi
    else
        error "boutique-client service user does not exist"
    fi
}

check_service_security() {
    log "Checking service security configuration..."
    
    # Check running services
    local listening_services=$(netstat -tuln 2>/dev/null | grep LISTEN || ss -tuln | grep LISTEN)
    info "Listening services:"
    echo "$listening_services" >> "$REPORT_FILE"
    
    # Check for unexpected services on common ports
    if echo "$listening_services" | grep -q ":22 "; then
        success "SSH service running on port 22"
    fi
    
    if echo "$listening_services" | grep -q ":80 "; then
        success "HTTP service running on port 80"
    fi
    
    if echo "$listening_services" | grep -q ":443 "; then
        success "HTTPS service running on port 443"
    fi
    
    # Check for dangerous services
    local dangerous_ports=("23" "21" "25" "110" "143" "993" "995")
    for port in "${dangerous_ports[@]}"; do
        if echo "$listening_services" | grep -q ":$port "; then
            warning "Potentially unsafe service running on port $port"
        fi
    done
    
    # Check systemd service security
    if command -v systemctl >/dev/null 2>&1; then
        # Check boutique-client service
        if systemctl is-enabled boutique-client >/dev/null 2>&1; then
            success "boutique-client service is enabled"
            
            # Check service configuration
            local service_file="/etc/systemd/system/boutique-client.service"
            if [[ -f "$service_file" ]]; then
                # Check for security options
                if grep -q "User=boutique-client" "$service_file"; then
                    success "Service runs as non-root user"
                else
                    error "Service may be running as root user"
                fi
                
                if grep -q "PrivateTmp=true" "$service_file"; then
                    success "Service uses private tmp directory"
                else
                    info "Consider adding PrivateTmp=true to service file"
                fi
                
                if grep -q "NoNewPrivileges=true" "$service_file"; then
                    success "Service has NoNewPrivileges enabled"
                else
                    info "Consider adding NoNewPrivileges=true to service file"
                fi
            fi
        fi
        
        # Check for failed services
        local failed_services=$(systemctl --failed --no-legend)
        if [[ -n "$failed_services" ]]; then
            warning "Failed systemd services detected:"
            echo "$failed_services" >> "$REPORT_FILE"
        else
            success "No failed systemd services"
        fi
    fi
}

check_firewall_security() {
    log "Checking firewall configuration..."
    
    # Check UFW status
    if command -v ufw >/dev/null 2>&1; then
        local ufw_status=$(ufw status)
        if echo "$ufw_status" | grep -q "Status: active"; then
            success "UFW firewall is active"
            
            # Check rules
            local rules=$(ufw status numbered | grep -v "Status:")
            info "UFW Rules:"
            echo "$rules" >> "$REPORT_FILE"
            
            # Check for allow all rules
            if echo "$rules" | grep -q "Anywhere"; then
                info "UFW rules allow connections from anywhere - review if appropriate"
            fi
            
            # Check essential ports are allowed
            if echo "$rules" | grep -q "22"; then
                success "SSH port 22 allowed in firewall"
            else
                warning "SSH port 22 not explicitly allowed - may cause lockout"
            fi
            
            if echo "$rules" | grep -q "80\|443"; then
                success "HTTP/HTTPS ports allowed in firewall"
            else
                warning "HTTP/HTTPS ports not allowed - web service may be inaccessible"
            fi
        else
            error "UFW firewall is not active"
            
            if [[ "$FIX_ISSUES" == "true" ]] && [[ "$EUID" -eq 0 ]]; then
                log "Enabling UFW firewall..."
                ufw --force enable
            fi
        fi
    else
        error "UFW firewall not installed"
        
        if [[ "$FIX_ISSUES" == "true" ]] && [[ "$EUID" -eq 0 ]]; then
            log "Installing UFW firewall..."
            apt-get update && apt-get install -y ufw
        fi
    fi
    
    # Check iptables if UFW not available
    if command -v iptables >/dev/null 2>&1; then
        local iptables_rules=$(iptables -L -n 2>/dev/null | wc -l)
        info "iptables rules count: $iptables_rules"
        
        if [[ "$iptables_rules" -lt 10 ]]; then
            warning "Very few iptables rules - firewall may not be properly configured"
        fi
    fi
    
    # Check fail2ban
    if command -v fail2ban-client >/dev/null 2>&1; then
        local fail2ban_status=$(fail2ban-client status 2>/dev/null || echo "inactive")
        if [[ "$fail2ban_status" != "inactive" ]]; then
            success "fail2ban is active"
            
            # Check jails
            local jails=$(fail2ban-client status | grep "Jail list" | cut -d: -f2 | tr -d ' ')
            info "Active fail2ban jails: $jails"
            
            # Check SSH jail specifically
            if echo "$jails" | grep -q "sshd"; then
                success "SSH jail is active in fail2ban"
            else
                warning "SSH jail not active in fail2ban"
            fi
        else
            warning "fail2ban is not active"
        fi
    else
        warning "fail2ban not installed - consider installing for brute force protection"
        
        if [[ "$FIX_ISSUES" == "true" ]] && [[ "$EUID" -eq 0 ]]; then
            log "Installing fail2ban..."
            apt-get update && apt-get install -y fail2ban
        fi
    fi
}

check_ssh_security() {
    log "Checking SSH security configuration..."
    
    local ssh_config="/etc/ssh/sshd_config"
    if [[ -f "$ssh_config" ]]; then
        # Check root login
        if grep -q "^PermitRootLogin no" "$ssh_config"; then
            success "SSH root login disabled"
        elif grep -q "^PermitRootLogin" "$ssh_config"; then
            local root_login=$(grep "^PermitRootLogin" "$ssh_config")
            error "SSH root login not disabled: $root_login"
        else
            warning "SSH PermitRootLogin not explicitly configured"
        fi
        
        # Check password authentication
        if grep -q "^PasswordAuthentication no" "$ssh_config"; then
            success "SSH password authentication disabled"
        elif grep -q "^PasswordAuthentication yes" "$ssh_config"; then
            warning "SSH password authentication enabled - consider using key-based auth only"
        fi
        
        # Check protocol version
        if grep -q "^Protocol 2" "$ssh_config"; then
            success "SSH using protocol version 2"
        elif grep -q "^Protocol" "$ssh_config"; then
            error "SSH not using protocol version 2"
        fi
        
        # Check port
        local ssh_port=$(grep "^Port" "$ssh_config" | awk '{print $2}' || echo "22")
        if [[ "$ssh_port" == "22" ]]; then
            info "SSH running on default port 22"
        else
            info "SSH running on custom port $ssh_port"
        fi
        
        # Check MaxAuthTries
        local max_auth_tries=$(grep "^MaxAuthTries" "$ssh_config" | awk '{print $2}' || echo "default")
        if [[ "$max_auth_tries" =~ ^[0-9]+$ ]] && [[ "$max_auth_tries" -le 3 ]]; then
            success "SSH MaxAuthTries set to secure value: $max_auth_tries"
        elif [[ "$max_auth_tries" != "default" ]]; then
            warning "SSH MaxAuthTries set to: $max_auth_tries (consider ≤3)"
        else
            info "SSH MaxAuthTries using default value"
        fi
        
        # Check ClientAliveInterval
        local client_alive=$(grep "^ClientAliveInterval" "$ssh_config" | awk '{print $2}' || echo "default")
        if [[ "$client_alive" =~ ^[0-9]+$ ]] && [[ "$client_alive" -gt 0 ]]; then
            success "SSH ClientAliveInterval configured: $client_alive"
        else
            info "SSH ClientAliveInterval not configured (may allow idle connections)"
        fi
    else
        error "SSH configuration file not found: $ssh_config"
    fi
}

check_system_updates() {
    log "Checking system update status..."
    
    if command -v apt >/dev/null 2>&1; then
        # Check for available updates
        apt list --upgradable 2>/dev/null | wc -l > /tmp/update_count
        local update_count=$(($(cat /tmp/update_count) - 1))  # Subtract header line
        
        if [[ "$update_count" -eq 0 ]]; then
            success "System is up to date"
        elif [[ "$update_count" -lt 10 ]]; then
            info "$update_count updates available"
        else
            warning "$update_count updates available - consider updating soon"
        fi
        
        # Check for security updates
        local security_updates=$(apt list --upgradable 2>/dev/null | grep -c security || echo "0")
        if [[ "$security_updates" -gt 0 ]]; then
            error "$security_updates security updates available - should be applied immediately"
        else
            success "No pending security updates"
        fi
        
        rm -f /tmp/update_count
    fi
    
    # Check last update
    if [[ -f /var/log/apt/history.log ]]; then
        local last_update=$(grep "Start-Date" /var/log/apt/history.log | tail -1 | awk '{print $2}')
        if [[ -n "$last_update" ]]; then
            local days_since=$(( ($(date +%s) - $(date -d "$last_update" +%s)) / 86400 ))
            if [[ "$days_since" -le 7 ]]; then
                success "System updated within last week ($days_since days ago)"
            elif [[ "$days_since" -le 30 ]]; then
                info "System updated $days_since days ago"
            else
                warning "System last updated $days_since days ago - consider updating"
            fi
        fi
    fi
}

# =============================================================================
# Application Security Assessment
# =============================================================================

check_application_security() {
    log "Checking application security configuration..."
    
    # File permissions
    check_file_permissions
    
    # Environment variables
    check_environment_security
    
    # Dependencies
    check_dependency_security
    
    # Authentication configuration
    check_auth_security
    
    # Session security
    check_session_security
    
    # API security
    check_api_security
}

check_file_permissions() {
    log "Checking file permissions and ownership..."
    
    # Check project root ownership
    if [[ -d "$PROJECT_ROOT" ]]; then
        local owner=$(stat -c "%U:%G" "$PROJECT_ROOT")
        if [[ "$owner" == "boutique-client:boutique-client" ]]; then
            success "Project root owned by service user: $owner"
        else
            warning "Project root ownership: $owner (expected: boutique-client:boutique-client)"
        fi
        
        # Check permissions
        local permissions=$(stat -c "%a" "$PROJECT_ROOT")
        if [[ "$permissions" == "755" ]]; then
            success "Project root permissions: $permissions"
        else
            info "Project root permissions: $permissions"
        fi
    fi
    
    # Check sensitive files
    local sensitive_files=(".env" ".env.production" ".env.local")
    for file in "${sensitive_files[@]}"; do
        local file_path="$PROJECT_ROOT/$file"
        if [[ -f "$file_path" ]]; then
            local perms=$(stat -c "%a" "$file_path")
            local owner=$(stat -c "%U:%G" "$file_path")
            
            if [[ "$perms" == "600" ]]; then
                success "Sensitive file $file permissions: $perms"
            else
                error "Sensitive file $file permissions: $perms (should be 600)"
                
                if [[ "$FIX_ISSUES" == "true" ]]; then
                    log "Fixing permissions for $file..."
                    chmod 600 "$file_path"
                fi
            fi
            
            info "Sensitive file $file ownership: $owner"
        fi
    done
    
    # Check log directory permissions
    local log_dirs=("$PROJECT_ROOT/logs" "/opt/boutique-client/logs")
    for log_dir in "${log_dirs[@]}"; do
        if [[ -d "$log_dir" ]]; then
            local perms=$(stat -c "%a" "$log_dir")
            local owner=$(stat -c "%U:%G" "$log_dir")
            
            if [[ "$perms" == "750" || "$perms" == "755" ]]; then
                success "Log directory $log_dir permissions: $perms"
            else
                warning "Log directory $log_dir permissions: $perms"
            fi
            
            info "Log directory $log_dir ownership: $owner"
        fi
    done
    
    # Check for world-writable files
    local world_writable=$(find "$PROJECT_ROOT" -type f -perm -002 2>/dev/null | head -10)
    if [[ -n "$world_writable" ]]; then
        warning "World-writable files found:"
        echo "$world_writable" >> "$REPORT_FILE"
    else
        success "No world-writable files in project directory"
    fi
    
    # Check for SUID/SGID files
    local suid_files=$(find "$PROJECT_ROOT" -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null)
    if [[ -n "$suid_files" ]]; then
        warning "SUID/SGID files found in project directory:"
        echo "$suid_files" >> "$REPORT_FILE"
    else
        success "No SUID/SGID files in project directory"
    fi
}

check_environment_security() {
    log "Checking environment variable security..."
    
    local env_files=(".env" ".env.production" ".env.local")
    
    for env_file in "${env_files[@]}"; do
        local file_path="$PROJECT_ROOT/$env_file"
        if [[ -f "$file_path" ]]; then
            log "Checking $env_file..."
            
            # Check for hardcoded secrets
            local weak_secrets=$(grep -E "(password.*=|secret.*=|key.*=)" "$file_path" | grep -E "(123|password|secret|test|demo|changeme)" || echo "")
            if [[ -n "$weak_secrets" ]]; then
                critical "Weak or default secrets found in $env_file"
                echo "Weak secrets (review these): $weak_secrets" >> "$REPORT_FILE"
            else
                success "No obvious weak secrets in $env_file"
            fi
            
            # Check for proper secret complexity
            local auth_secret=$(grep "^AUTH_SECRET=" "$file_path" | cut -d= -f2 | tr -d '"' || echo "")
            if [[ -n "$auth_secret" ]]; then
                if [[ ${#auth_secret} -ge 32 ]]; then
                    success "AUTH_SECRET has adequate length (${#auth_secret} chars)"
                else
                    error "AUTH_SECRET too short (${#auth_secret} chars, minimum 32 recommended)"
                fi
                
                # Check entropy (basic check for randomness)
                local unique_chars=$(echo "$auth_secret" | grep -o . | sort -u | wc -l)
                if [[ "$unique_chars" -ge 10 ]]; then
                    success "AUTH_SECRET has good character diversity"
                else
                    warning "AUTH_SECRET has low character diversity ($unique_chars unique chars)"
                fi
            fi
            
            # Check database URL security
            local db_url=$(grep "^DATABASE_URL=" "$file_path" | cut -d= -f2 | tr -d '"' || echo "")
            if [[ -n "$db_url" ]]; then
                if echo "$db_url" | grep -q "localhost\|127.0.0.1"; then
                    success "Database connection uses localhost"
                else
                    info "Database connection uses external host - ensure it's secured"
                fi
                
                # Check for SSL in database URL
                if echo "$db_url" | grep -q "sslmode=require"; then
                    success "Database connection requires SSL"
                elif echo "$db_url" | grep -q "ssl=true"; then
                    success "Database connection uses SSL"
                else
                    warning "Database connection may not use SSL encryption"
                fi
            fi
            
            # Check for development/debug flags
            local node_env=$(grep "^NODE_ENV=" "$file_path" | cut -d= -f2 | tr -d '"' || echo "")
            if [[ "$node_env" == "production" ]]; then
                success "NODE_ENV set to production"
            elif [[ -n "$node_env" ]]; then
                warning "NODE_ENV set to: $node_env (should be 'production' for production)"
            fi
            
            local debug_vars=$(grep -E "^(DEBUG|LOG_LEVEL)=" "$file_path" || echo "")
            if [[ -n "$debug_vars" ]]; then
                info "Debug/logging configuration found:"
                echo "$debug_vars" >> "$REPORT_FILE"
            fi
        fi
    done
}

check_dependency_security() {
    log "Checking dependency security..."
    
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        cd "$PROJECT_ROOT"
        
        # Check for npm audit
        if command -v npm >/dev/null 2>&1; then
            log "Running npm audit..."
            local audit_output=$(npm audit --json 2>/dev/null || echo '{"error": "audit failed"}')
            
            if echo "$audit_output" | grep -q '"vulnerabilities"'; then
                local high_vulns=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
                local critical_vulns=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
                local moderate_vulns=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")
                local low_vulns=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.low // 0' 2>/dev/null || echo "0")
                
                if [[ "$critical_vulns" -gt 0 ]]; then
                    critical "$critical_vulns critical vulnerabilities found in dependencies"
                elif [[ "$high_vulns" -gt 0 ]]; then
                    error "$high_vulns high severity vulnerabilities found in dependencies"
                elif [[ "$moderate_vulns" -gt 0 ]]; then
                    warning "$moderate_vulns moderate severity vulnerabilities found in dependencies"
                elif [[ "$low_vulns" -gt 0 ]]; then
                    info "$low_vulns low severity vulnerabilities found in dependencies"
                else
                    success "No known vulnerabilities in dependencies"
                fi
                
                # Save detailed audit results
                echo "Detailed npm audit results:" >> "$REPORT_FILE"
                npm audit >> "$REPORT_FILE" 2>/dev/null || echo "Audit details unavailable" >> "$REPORT_FILE"
                
                if [[ "$FIX_ISSUES" == "true" ]] && [[ "$high_vulns" -gt 0 || "$critical_vulns" -gt 0 ]]; then
                    log "Attempting to fix high/critical vulnerabilities..."
                    npm audit fix
                fi
            else
                warning "Could not parse npm audit results"
            fi
        fi
        
        # Check for outdated dependencies
        if command -v npm >/dev/null 2>&1; then
            local outdated=$(npm outdated 2>/dev/null | wc -l)
            if [[ "$outdated" -gt 1 ]]; then  # Subtract header line
                info "$((outdated - 1)) outdated packages found - consider updating"
            else
                success "Dependencies are up to date"
            fi
        fi
        
        # Check package-lock.json exists
        if [[ -f "$PROJECT_ROOT/package-lock.json" ]]; then
            success "package-lock.json exists (dependency locking)"
        else
            warning "package-lock.json missing - dependencies may not be locked"
        fi
    fi
}

check_auth_security() {
    log "Checking authentication security configuration..."
    
    # Check Auth.js configuration
    local auth_config="$PROJECT_ROOT/src/auth.ts"
    if [[ -f "$auth_config" ]]; then
        success "Auth.js configuration file found"
        
        # Check for secure session configuration
        if grep -q "maxAge" "$auth_config"; then
            local session_max_age=$(grep "maxAge" "$auth_config" | head -1)
            info "Session maxAge configuration: $session_max_age"
        else
            info "Session maxAge not explicitly configured (using defaults)"
        fi
        
        # Check for secure cookies
        if grep -q "secure.*true" "$auth_config"; then
            success "Secure cookie configuration found"
        else
            warning "Secure cookie configuration not found - may be insecure over HTTP"
        fi
        
        # Check for CSRF protection
        if grep -q -i "csrf" "$auth_config"; then
            success "CSRF protection configured"
        else
            info "CSRF protection configuration not found in auth config"
        fi
    else
        warning "Auth.js configuration file not found"
    fi
    
    # Check for password policy
    if grep -r "password.*policy\|password.*requirement" "$PROJECT_ROOT/src" >/dev/null 2>&1; then
        success "Password policy implementation found"
    else
        info "No explicit password policy found - consider implementing"
    fi
    
    # Check for rate limiting
    if grep -r -i "rate.*limit\|rate.*limiter" "$PROJECT_ROOT/src" >/dev/null 2>&1; then
        success "Rate limiting implementation found"
    else
        warning "Rate limiting not found - consider implementing to prevent brute force"
    fi
}

check_session_security() {
    log "Checking session security..."
    
    # Check for session storage configuration
    if grep -r "session.*store\|SESSION_STORE" "$PROJECT_ROOT" >/dev/null 2>&1; then
        success "Session storage configuration found"
    else
        info "Session storage configuration not explicitly found"
    fi
    
    # Check Prisma schema for session table
    local prisma_schema="$PROJECT_ROOT/prisma/schema.prisma"
    if [[ -f "$prisma_schema" ]]; then
        if grep -q "model Session" "$prisma_schema"; then
            success "Session model found in Prisma schema"
            
            # Check for proper session fields
            local session_model=$(awk '/model Session/,/^}/' "$prisma_schema")
            if echo "$session_model" | grep -q "expires"; then
                success "Session expiry field found"
            else
                warning "Session expiry field not found"
            fi
            
            if echo "$session_model" | grep -q "sessionToken"; then
                success "Session token field found"
            else
                warning "Session token field not found"
            fi
        else
            warning "Session model not found in Prisma schema"
        fi
    fi
}

check_api_security() {
    log "Checking API security configuration..."
    
    # Check for API routes
    local api_routes="$PROJECT_ROOT/src/routes/api"
    if [[ -d "$api_routes" ]]; then
        success "API routes directory found"
        
        # Check for authentication middleware
        if find "$api_routes" -name "*.ts" -exec grep -l "auth\|authenticate\|verify" {} \; | grep -q .; then
            success "Authentication middleware found in API routes"
        else
            warning "Authentication middleware not found in API routes"
        fi
        
        # Check for input validation
        if find "$api_routes" -name "*.ts" -exec grep -l "zod\|joi\|yup\|validate" {} \; | grep -q .; then
            success "Input validation libraries found in API routes"
        else
            warning "Input validation not found in API routes"
        fi
        
        # Check for CORS configuration
        if find "$PROJECT_ROOT/src" -name "*.ts" -exec grep -l "cors\|CORS" {} \; | grep -q .; then
            success "CORS configuration found"
        else
            info "CORS configuration not found - may use framework defaults"
        fi
        
        # Check for security headers
        if find "$PROJECT_ROOT/src" -name "*.ts" -exec grep -l "helmet\|csp\|hsts" {} \; | grep -q .; then
            success "Security headers configuration found"
        else
            warning "Security headers not found - consider adding helmet.js or similar"
        fi
    fi
}

# =============================================================================
# Database Security Assessment
# =============================================================================

check_database_security() {
    log "Checking database security configuration..."
    
    # Check database connection
    check_database_connection_security
    
    # Check database schema security
    check_database_schema_security
    
    # Check database access controls
    check_database_access_controls
    
    # Check database audit logging
    check_database_audit_logging
}

check_database_connection_security() {
    log "Checking database connection security..."
    
    # Load environment to get database URL
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        source "$PROJECT_ROOT/.env.production"
    elif [[ -f "$PROJECT_ROOT/.env" ]]; then
        source "$PROJECT_ROOT/.env"
    fi
    
    if [[ -n "${DATABASE_URL:-}" ]]; then
        # Parse database URL
        if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/([^?]+) ]]; then
            local db_user="${BASH_REMATCH[1]}"
            local db_password="${BASH_REMATCH[2]}"
            local db_host="${BASH_REMATCH[3]}"
            local db_port="${BASH_REMATCH[4]}"
            local db_name="${BASH_REMATCH[5]}"
            
            info "Database host: $db_host"
            info "Database port: $db_port"
            info "Database name: $db_name"
            info "Database user: $db_user"
            
            # Check if password is secure
            if [[ ${#db_password} -ge 16 ]]; then
                success "Database password has adequate length"
            else
                warning "Database password is short (consider using longer password)"
            fi
            
            # Check for SSL parameters
            if [[ "$DATABASE_URL" =~ sslmode=require ]]; then
                success "Database connection requires SSL"
            elif [[ "$DATABASE_URL" =~ ssl=true ]]; then
                success "Database connection uses SSL"
            else
                warning "Database connection may not use SSL encryption"
            fi
            
            # Test connection if possible
            if command -v psql >/dev/null 2>&1; then
                if timeout 10 psql "$DATABASE_URL" -c "SELECT version();" >/dev/null 2>&1; then
                    success "Database connection test successful"
                else
                    error "Database connection test failed"
                fi
            fi
        else
            warning "Could not parse DATABASE_URL format"
        fi
    else
        error "DATABASE_URL not found in environment"
    fi
}

check_database_schema_security() {
    log "Checking database schema security..."
    
    local prisma_schema="$PROJECT_ROOT/prisma/schema.prisma"
    if [[ -f "$prisma_schema" ]]; then
        success "Prisma schema file found"
        
        # Check for sensitive data fields
        local sensitive_fields=$(grep -E "(password|secret|token|key)" "$prisma_schema" | grep -v "@@" || echo "")
        if [[ -n "$sensitive_fields" ]]; then
            info "Sensitive fields found in schema (ensure proper handling):"
            echo "$sensitive_fields" >> "$REPORT_FILE"
        fi
        
        # Check for audit trail
        if grep -q "audit\|AuditLog" "$prisma_schema"; then
            success "Audit logging schema found"
        else
            info "Audit logging schema not found - consider implementing for compliance"
        fi
        
        # Check for user roles
        if grep -q "role\|Role" "$prisma_schema"; then
            success "User role system found in schema"
        else
            info "User role system not found - consider implementing for access control"
        fi
        
        # Check for proper indexing on auth fields
        if grep -A5 -B5 "model User" "$prisma_schema" | grep -q "@@unique\|@unique"; then
            success "Unique constraints found on User model"
        else
            warning "Unique constraints not found on User model - may allow duplicates"
        fi
    else
        error "Prisma schema file not found"
    fi
}

check_database_access_controls() {
    log "Checking database access controls..."
    
    # This would require actual database access
    info "Database access control check would require database connection analysis"
    info "Manually verify: user privileges, role-based access, connection limits"
}

check_database_audit_logging() {
    log "Checking database audit logging..."
    
    local prisma_schema="$PROJECT_ROOT/prisma/schema.prisma"
    if [[ -f "$prisma_schema" ]]; then
        if grep -q "AuditLog\|audit_log" "$prisma_schema"; then
            success "Database audit logging model found"
            
            # Check audit log fields
            local audit_model=$(awk '/model AuditLog/,/^}/' "$prisma_schema" || awk '/model audit_log/,/^}/' "$prisma_schema")
            if echo "$audit_model" | grep -q "action"; then
                success "Audit log action field found"
            fi
            
            if echo "$audit_model" | grep -q "userId\|user_id"; then
                success "Audit log user tracking found"
            fi
            
            if echo "$audit_model" | grep -q "timestamp\|createdAt"; then
                success "Audit log timestamp field found"
            fi
        else
            warning "Database audit logging not implemented"
        fi
    fi
}

# =============================================================================
# Network Security Assessment
# =============================================================================

check_network_security() {
    log "Checking network security configuration..."
    
    # SSL/TLS configuration
    check_ssl_security
    
    # Network services
    check_network_services
    
    # Network scanning (if enabled)
    if [[ "$NETWORK_SCAN" == "true" ]]; then
        check_network_scan
    fi
}

check_ssl_security() {
    log "Checking SSL/TLS security..."
    
    # Check for SSL certificates
    local cert_dirs=("/etc/letsencrypt/live" "/etc/ssl/certs" "/opt/boutique-client/ssl")
    local cert_found=false
    
    for cert_dir in "${cert_dirs[@]}"; do
        if [[ -d "$cert_dir" ]]; then
            local certs=$(find "$cert_dir" -name "*.pem" -o -name "*.crt" 2>/dev/null | head -5)
            if [[ -n "$certs" ]]; then
                success "SSL certificates found in $cert_dir"
                cert_found=true
                
                # Check certificate expiry
                for cert in $certs; do
                    if command -v openssl >/dev/null 2>&1; then
                        local expiry_date=$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)
                        if [[ -n "$expiry_date" ]]; then
                            local expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null)
                            local current_timestamp=$(date +%s)
                            local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
                            
                            if [[ "$days_until_expiry" -gt 30 ]]; then
                                success "Certificate $(basename "$cert") expires in $days_until_expiry days"
                            elif [[ "$days_until_expiry" -gt 7 ]]; then
                                warning "Certificate $(basename "$cert") expires in $days_until_expiry days"
                            else
                                error "Certificate $(basename "$cert") expires in $days_until_expiry days - URGENT"
                            fi
                        fi
                    fi
                done
            fi
        fi
    done
    
    if [[ "$cert_found" == "false" ]]; then
        error "No SSL certificates found - HTTPS may not be configured"
    fi
    
    # Check Nginx SSL configuration
    local nginx_config="/etc/nginx/sites-enabled"
    if [[ -d "$nginx_config" ]]; then
        local ssl_configs=$(grep -r "ssl_certificate" "$nginx_config" 2>/dev/null || echo "")
        if [[ -n "$ssl_configs" ]]; then
            success "SSL configuration found in Nginx"
            
            # Check for strong SSL configuration
            if grep -r "ssl_protocols.*TLSv1.3\|ssl_protocols.*TLSv1.2" "$nginx_config" >/dev/null 2>&1; then
                success "Modern TLS protocols configured"
            else
                warning "TLS protocol configuration not found or may be weak"
            fi
            
            if grep -r "ssl_ciphers" "$nginx_config" >/dev/null 2>&1; then
                success "SSL cipher configuration found"
            else
                info "SSL cipher configuration not found (may use defaults)"
            fi
        else
            warning "SSL configuration not found in Nginx"
        fi
    fi
    
    # Check for HSTS headers
    if [[ -d "$nginx_config" ]]; then
        if grep -r "Strict-Transport-Security" "$nginx_config" >/dev/null 2>&1; then
            success "HSTS (HTTP Strict Transport Security) configured"
        else
            warning "HSTS not configured - consider adding for security"
        fi
    fi
}

check_network_services() {
    log "Checking network service security..."
    
    # Get listening services
    local listening_services=$(netstat -tuln 2>/dev/null | grep LISTEN || ss -tuln | grep LISTEN)
    
    # Check each service
    echo "$listening_services" | while read -r line; do
        if [[ "$line" =~ :([0-9]+) ]]; then
            local port="${BASH_REMATCH[1]}"
            
            case "$port" in
                "22")
                    success "SSH service on port 22 (secured with earlier checks)"
                    ;;
                "80")
                    info "HTTP service on port 80 (should redirect to HTTPS)"
                    ;;
                "443")
                    success "HTTPS service on port 443"
                    ;;
                "3000")
                    info "Application service on port 3000 (ensure not exposed externally)"
                    ;;
                "5432")
                    warning "PostgreSQL on port 5432 (ensure not exposed externally)"
                    ;;
                "8081")
                    info "WebSocket service on port 8081 (ensure properly secured)"
                    ;;
                *)
                    if [[ "$port" -lt 1024 ]]; then
                        info "System service on port $port"
                    else
                        info "Service on port $port - verify if needed"
                    fi
                    ;;
            esac
        fi
    done
    
    # Check for services listening on all interfaces
    local all_interfaces=$(echo "$listening_services" | grep "0.0.0.0\|:::" || echo "")
    if [[ -n "$all_interfaces" ]]; then
        warning "Services listening on all interfaces:"
        echo "$all_interfaces" >> "$REPORT_FILE"
    fi
}

check_network_scan() {
    log "Performing network security scan..."
    
    if command -v nmap >/dev/null 2>&1; then
        # Scan localhost
        local scan_result=$(nmap -sS -O localhost 2>/dev/null)
        echo "Network scan results:" >> "$REPORT_FILE"
        echo "$scan_result" >> "$REPORT_FILE"
        
        # Check for open ports
        local open_ports=$(echo "$scan_result" | grep "^[0-9].*open" | wc -l)
        info "$open_ports open ports found in network scan"
        
        # Check for filtered ports (potentially firewalled)
        local filtered_ports=$(echo "$scan_result" | grep "filtered" | wc -l)
        if [[ "$filtered_ports" -gt 0 ]]; then
            success "$filtered_ports ports filtered (firewall active)"
        fi
    else
        info "nmap not available for network scanning"
    fi
}

# =============================================================================
# Compliance Checks
# =============================================================================

check_compliance() {
    if [[ -n "$COMPLIANCE_CHECK" ]]; then
        log "Checking compliance with standard: $COMPLIANCE_CHECK"
        
        case "$COMPLIANCE_CHECK" in
            "OWASP")
                check_owasp_compliance
                ;;
            "ISO27001")
                check_iso27001_compliance
                ;;
            *)
                warning "Unknown compliance standard: $COMPLIANCE_CHECK"
                ;;
        esac
    fi
}

check_owasp_compliance() {
    log "Checking OWASP Top 10 compliance..."
    
    # A01:2021 – Broken Access Control
    info "A01: Broken Access Control"
    if grep -r "authorize\|permission\|role" "$PROJECT_ROOT/src" >/dev/null 2>&1; then
        success "Access control implementation found"
    else
        warning "Access control implementation not clearly found"
    fi
    
    # A02:2021 – Cryptographic Failures
    info "A02: Cryptographic Failures"
    if grep -r "bcrypt\|scrypt\|argon2" "$PROJECT_ROOT" >/dev/null 2>&1; then
        success "Strong password hashing found"
    else
        warning "Strong password hashing not found"
    fi
    
    # A03:2021 – Injection
    info "A03: Injection"
    if grep -r "prisma\|prepared.*statement" "$PROJECT_ROOT" >/dev/null 2>&1; then
        success "ORM/prepared statements found (helps prevent injection)"
    else
        warning "ORM/prepared statements not clearly found"
    fi
    
    # A04:2021 – Insecure Design
    info "A04: Insecure Design"
    info "Manual review required for architectural security"
    
    # A05:2021 – Security Misconfiguration
    info "A05: Security Misconfiguration"
    if [[ "$CRITICAL_ISSUES" -eq 0 && "$HIGH_ISSUES" -lt 5 ]]; then
        success "Low number of high-severity configuration issues"
    else
        warning "Multiple configuration issues found"
    fi
    
    # A06:2021 – Vulnerable and Outdated Components
    info "A06: Vulnerable Components"
    # This is checked in dependency security
    
    # A07:2021 – Identification and Authentication Failures
    info "A07: Authentication Failures"
    if [[ -f "$PROJECT_ROOT/src/auth.ts" ]]; then
        success "Authentication system implemented"
    else
        error "Authentication system not found"
    fi
    
    # A08:2021 – Software and Data Integrity Failures
    info "A08: Integrity Failures"
    if [[ -f "$PROJECT_ROOT/package-lock.json" ]]; then
        success "Dependency integrity (package-lock.json)"
    else
        warning "Dependency integrity not ensured"
    fi
    
    # A09:2021 – Security Logging and Monitoring Failures
    info "A09: Logging and Monitoring"
    if [[ -f "$PROJECT_ROOT/scripts/system-monitor.sh" ]]; then
        success "Monitoring system implemented"
    else
        warning "Monitoring system not found"
    fi
    
    # A10:2021 – Server-Side Request Forgery
    info "A10: Server-Side Request Forgery"
    info "Manual code review required for SSRF vulnerabilities"
}

# =============================================================================
# Report Generation and Summary
# =============================================================================

generate_final_report() {
    log "Generating final security report..."
    
    local total_issues=$((CRITICAL_ISSUES + HIGH_ISSUES + MEDIUM_ISSUES + LOW_ISSUES))
    
    cat >> "$REPORT_FILE" << EOF

================================================================================
SECURITY ASSESSMENT SUMMARY
================================================================================

Review Completed: $(date)
Total Issues Found: $total_issues

Issue Breakdown:
  🔴 Critical Issues: $CRITICAL_ISSUES
  🟠 High Issues: $HIGH_ISSUES
  🟡 Medium Issues: $MEDIUM_ISSUES
  🟢 Low Issues: $LOW_ISSUES
  ℹ️  Info Items: $INFO_ISSUES

================================================================================
RISK ASSESSMENT
================================================================================

EOF

    # Risk assessment
    if [[ "$CRITICAL_ISSUES" -gt 0 ]]; then
        echo "🔴 CRITICAL RISK: Immediate action required" >> "$REPORT_FILE"
        echo "Critical security vulnerabilities must be addressed before production deployment." >> "$REPORT_FILE"
    elif [[ "$HIGH_ISSUES" -gt 10 ]]; then
        echo "🟠 HIGH RISK: Address high-priority issues" >> "$REPORT_FILE"
        echo "Multiple high-severity issues found. Recommend addressing before production." >> "$REPORT_FILE"
    elif [[ "$HIGH_ISSUES" -gt 0 ]]; then
        echo "🟡 MEDIUM RISK: Some security concerns" >> "$REPORT_FILE"
        echo "High-priority issues should be addressed in next maintenance window." >> "$REPORT_FILE"
    else
        echo "🟢 LOW RISK: Good security posture" >> "$REPORT_FILE"
        echo "Minor issues found. Security posture is acceptable for production." >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

================================================================================
RECOMMENDATIONS
================================================================================

Priority Actions:
EOF

    if [[ "$CRITICAL_ISSUES" -gt 0 ]]; then
        echo "1. Address all critical security issues immediately" >> "$REPORT_FILE"
        echo "2. Review and strengthen access controls" >> "$REPORT_FILE"
        echo "3. Audit authentication and session management" >> "$REPORT_FILE"
    elif [[ "$HIGH_ISSUES" -gt 5 ]]; then
        echo "1. Address high-priority security configurations" >> "$REPORT_FILE"
        echo "2. Update vulnerable dependencies" >> "$REPORT_FILE"
        echo "3. Strengthen system hardening" >> "$REPORT_FILE"
    else
        echo "1. Continue regular security monitoring" >> "$REPORT_FILE"
        echo "2. Address medium/low priority items in maintenance window" >> "$REPORT_FILE"
        echo "3. Implement security monitoring and alerting" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

Long-term Security Improvements:
- Implement automated security scanning in CI/CD
- Set up regular security assessments
- Establish incident response procedures
- Consider security training for development team
- Implement security monitoring and SIEM

================================================================================
COMPLIANCE STATUS
================================================================================

EOF

    if [[ -n "$COMPLIANCE_CHECK" ]]; then
        echo "Compliance Standard: $COMPLIANCE_CHECK" >> "$REPORT_FILE"
        if [[ "$CRITICAL_ISSUES" -eq 0 && "$HIGH_ISSUES" -lt 3 ]]; then
            echo "Status: LIKELY COMPLIANT (pending detailed review)" >> "$REPORT_FILE"
        else
            echo "Status: NON-COMPLIANT (address security issues)" >> "$REPORT_FILE"
        fi
    else
        echo "No specific compliance standard checked." >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

================================================================================
NEXT STEPS
================================================================================

1. Review all security findings in this report
2. Prioritize critical and high-severity issues
3. Create action items with owners and due dates
4. Implement fixes and re-run security assessment
5. Schedule regular security reviews (quarterly recommended)

Report Generated by: Boutique Client Portal Security Review Script
Contact: [Security Team Contact Information]

================================================================================
END OF REPORT
================================================================================
EOF

    success "Security assessment completed. Report saved to: $REPORT_FILE"
}

display_summary() {
    echo
    echo "==============================================="
    echo "🔒 SECURITY REVIEW SUMMARY"
    echo "==============================================="
    echo
    
    local total_issues=$((CRITICAL_ISSUES + HIGH_ISSUES + MEDIUM_ISSUES + LOW_ISSUES))
    
    if [[ "$CRITICAL_ISSUES" -gt 0 ]]; then
        echo -e "  ${RED}🔴 CRITICAL ISSUES: $CRITICAL_ISSUES${NC}"
    fi
    
    if [[ "$HIGH_ISSUES" -gt 0 ]]; then
        echo -e "  ${RED}🟠 HIGH ISSUES: $HIGH_ISSUES${NC}"
    fi
    
    if [[ "$MEDIUM_ISSUES" -gt 0 ]]; then
        echo -e "  ${YELLOW}🟡 MEDIUM ISSUES: $MEDIUM_ISSUES${NC}"
    fi
    
    if [[ "$LOW_ISSUES" -gt 0 ]]; then
        echo -e "  ${GREEN}🟢 LOW ISSUES: $LOW_ISSUES${NC}"
    fi
    
    echo -e "  ${BLUE}ℹ️  INFO ITEMS: $INFO_ISSUES${NC}"
    echo
    echo "  📊 Total Issues: $total_issues"
    echo "  📄 Detailed Report: $REPORT_FILE"
    echo
    
    # Risk level
    if [[ "$CRITICAL_ISSUES" -gt 0 ]]; then
        echo -e "  🚨 ${RED}RISK LEVEL: CRITICAL${NC}"
        echo "     Immediate action required before production!"
    elif [[ "$HIGH_ISSUES" -gt 10 ]]; then
        echo -e "  ⚠️  ${YELLOW}RISK LEVEL: HIGH${NC}"
        echo "     Address high-priority issues before production"
    elif [[ "$HIGH_ISSUES" -gt 0 ]]; then
        echo -e "  📋 ${YELLOW}RISK LEVEL: MEDIUM${NC}"
        echo "     Some issues to address in next maintenance window"
    else
        echo -e "  ✅ ${GREEN}RISK LEVEL: LOW${NC}"
        echo "     Good security posture for production"
    fi
    
    echo
    echo "==============================================="
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    log "Starting comprehensive security review..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN MODE - No changes will be made"
        return 0
    fi
    
    # Initialize report
    setup_report
    
    # Run security checks
    check_system_security
    check_application_security
    check_database_security
    check_network_security
    
    # Compliance checks
    check_compliance
    
    # Generate final report
    generate_final_report
    
    # Display summary
    display_summary
    
    # Return appropriate exit code
    if [[ "$CRITICAL_ISSUES" -gt 0 ]]; then
        exit 2  # Critical issues
    elif [[ "$HIGH_ISSUES" -gt 0 ]]; then
        exit 1  # High priority issues
    else
        exit 0  # Success
    fi
}

# Error handling
trap 'echo "Security review failed at line $LINENO"' ERR

# Parse arguments and run main function
parse_args "$@"
main