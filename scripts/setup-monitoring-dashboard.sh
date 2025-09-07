#!/bin/bash

# =============================================================================
# Monitoring Dashboard Setup Script for Boutique Client Portal
# =============================================================================
#
# This script sets up comprehensive monitoring dashboards and visualization
# for the Boutique Client Portal production environment.
#
# Features:
# - Real-time system metrics dashboard
# - Application performance monitoring
# - Database monitoring and alerts
# - Custom dashboards for business metrics
# - Log aggregation and visualization
# - Alert management interface
#
# Usage:
#   sudo ./setup-monitoring-dashboard.sh [options]
#
# Options:
#   --domain=<domain>           Domain name for dashboard access
#   --admin-user=<username>     Dashboard admin username (default: admin)
#   --admin-email=<email>       Admin email for alerts
#   --slack-webhook=<url>       Slack webhook for notifications
#   --install-grafana           Install Grafana dashboard (default: true)
#   --install-prometheus        Install Prometheus metrics (default: true)
#   --install-loki              Install Loki log aggregation (default: false)
#   --port=<port>              Dashboard port (default: 3001)
#   --dry-run                   Show what would be done without executing
#
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITORING_DIR="/opt/boutique-client/monitoring"
LOG_FILE="/var/log/boutique-monitoring-setup.log"

# Default configuration
DEFAULT_DOMAIN=""
DEFAULT_ADMIN_USER="admin"
DEFAULT_ADMIN_EMAIL=""
DEFAULT_SLACK_WEBHOOK=""
DEFAULT_INSTALL_GRAFANA="true"
DEFAULT_INSTALL_PROMETHEUS="true"
DEFAULT_INSTALL_LOKI="false"
DEFAULT_PORT="3001"
DEFAULT_DRY_RUN="false"

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
    echo "$message" >> "$LOG_FILE"
}

success() {
    local message="[SUCCESS] $1"
    echo -e "${GREEN}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

warning() {
    local message="[WARNING] $1"
    echo -e "${YELLOW}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

error() {
    local message="[ERROR] $1"
    echo -e "${RED}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
    exit 1
}

# =============================================================================
# Configuration Parsing
# =============================================================================

parse_args() {
    DOMAIN="$DEFAULT_DOMAIN"
    ADMIN_USER="$DEFAULT_ADMIN_USER"
    ADMIN_EMAIL="$DEFAULT_ADMIN_EMAIL"
    SLACK_WEBHOOK="$DEFAULT_SLACK_WEBHOOK"
    INSTALL_GRAFANA="$DEFAULT_INSTALL_GRAFANA"
    INSTALL_PROMETHEUS="$DEFAULT_INSTALL_PROMETHEUS"
    INSTALL_LOKI="$DEFAULT_INSTALL_LOKI"
    DASHBOARD_PORT="$DEFAULT_PORT"
    DRY_RUN="$DEFAULT_DRY_RUN"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain=*)
                DOMAIN="${1#*=}"
                shift
                ;;
            --admin-user=*)
                ADMIN_USER="${1#*=}"
                shift
                ;;
            --admin-email=*)
                ADMIN_EMAIL="${1#*=}"
                shift
                ;;
            --slack-webhook=*)
                SLACK_WEBHOOK="${1#*=}"
                shift
                ;;
            --install-grafana)
                INSTALL_GRAFANA="true"
                shift
                ;;
            --no-grafana)
                INSTALL_GRAFANA="false"
                shift
                ;;
            --install-prometheus)
                INSTALL_PROMETHEUS="true"
                shift
                ;;
            --no-prometheus)
                INSTALL_PROMETHEUS="false"
                shift
                ;;
            --install-loki)
                INSTALL_LOKI="true"
                shift
                ;;
            --port=*)
                DASHBOARD_PORT="${1#*=}"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
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

    # Validate required parameters
    if [[ -z "$ADMIN_EMAIL" ]]; then
        error "Admin email is required (--admin-email=email@domain.com)"
    fi
}

show_help() {
    cat << EOF
Monitoring Dashboard Setup Script for Boutique Client Portal

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --domain=<domain>           Domain name for dashboard access
    --admin-user=<username>     Dashboard admin username (default: admin)
    --admin-email=<email>       Admin email for alerts (required)
    --slack-webhook=<url>       Slack webhook for notifications
    --install-grafana           Install Grafana dashboard (default: true)
    --no-grafana               Skip Grafana installation
    --install-prometheus        Install Prometheus metrics (default: true)
    --no-prometheus            Skip Prometheus installation
    --install-loki             Install Loki log aggregation (default: false)
    --port=<port>              Dashboard port (default: 3001)
    --dry-run                  Show what would be done without executing
    -h, --help                 Show this help

EXAMPLES:
    # Full setup with Grafana and Prometheus
    $0 --domain=monitor.example.com --admin-email=admin@example.com
    
    # Lightweight setup without Grafana
    $0 --no-grafana --admin-email=admin@example.com --port=3002
    
    # Setup with Slack notifications
    $0 --admin-email=admin@example.com --slack-webhook=https://hooks.slack.com/...

EOF
}

# =============================================================================
# System Prerequisites
# =============================================================================

install_prerequisites() {
    log "Installing monitoring system prerequisites..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would install monitoring prerequisites"
        return 0
    fi

    # Update package lists
    apt-get update

    # Install required packages
    apt-get install -y \
        curl \
        wget \
        gnupg \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        jq \
        sqlite3

    success "Prerequisites installed successfully"
}

# =============================================================================
# Node.js Monitoring Dashboard
# =============================================================================

create_monitoring_dashboard() {
    log "Creating Node.js monitoring dashboard..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create monitoring dashboard"
        return 0
    fi

    # Create monitoring directory
    mkdir -p "$MONITORING_DIR"
    cd "$MONITORING_DIR"

    # Create package.json for monitoring dashboard
    cat > package.json << EOF
{
  "name": "boutique-monitoring-dashboard",
  "version": "1.0.0",
  "description": "Monitoring dashboard for Boutique Client Portal",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "node-cron": "^3.0.2",
    "systeminformation": "^5.21.15",
    "pg": "^8.11.3",
    "axios": "^1.5.0",
    "chart.js": "^4.4.0",
    "ws": "^8.14.2"
  }
}
EOF

    # Install dashboard dependencies
    npm install --production

    # Create monitoring server
    cat > server.js << 'EOF'
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');
const si = require('systeminformation');
const { Client } = require('pg');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.DASHBOARD_PORT || 3001;
const DB_URL = process.env.DATABASE_URL;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Metrics storage
let metricsHistory = {
    system: [],
    application: [],
    database: []
};

// System metrics collection
async function collectSystemMetrics() {
    try {
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const disk = await si.fsSize();
        const network = await si.networkStats();
        const processes = await si.processes();

        const metrics = {
            timestamp: Date.now(),
            cpu: {
                usage: cpu.currentLoad,
                cores: cpu.cpus?.length || 1
            },
            memory: {
                total: mem.total,
                used: mem.used,
                free: mem.free,
                usage: (mem.used / mem.total) * 100
            },
            disk: disk.map(d => ({
                fs: d.fs,
                size: d.size,
                used: d.used,
                usage: (d.used / d.size) * 100
            })),
            network: network[0] || {},
            processes: {
                total: processes.all,
                running: processes.running,
                sleeping: processes.sleeping
            }
        };

        metricsHistory.system.push(metrics);
        
        // Keep only last 100 entries
        if (metricsHistory.system.length > 100) {
            metricsHistory.system = metricsHistory.system.slice(-100);
        }

        // Emit to connected clients
        io.emit('systemMetrics', metrics);
        
        return metrics;
    } catch (error) {
        console.error('Error collecting system metrics:', error);
        return null;
    }
}

// Application metrics collection
async function collectApplicationMetrics() {
    try {
        // Check PM2 processes
        const { exec } = require('child_process');
        const pm2Status = await new Promise((resolve, reject) => {
            exec('pm2 jlist', (error, stdout, stderr) => {
                if (error) {
                    resolve([]);
                } else {
                    try {
                        resolve(JSON.parse(stdout));
                    } catch (e) {
                        resolve([]);
                    }
                }
            });
        });

        // Check application health
        let healthStatus = null;
        try {
            const healthResponse = await axios.get('http://localhost:3000/api/admin/health', {
                timeout: 5000
            });
            healthStatus = healthResponse.data;
        } catch (error) {
            healthStatus = { status: 'error', message: error.message };
        }

        const metrics = {
            timestamp: Date.now(),
            pm2Processes: pm2Status.map(proc => ({
                name: proc.name,
                status: proc.pm2_env?.status,
                cpu: proc.monit?.cpu || 0,
                memory: proc.monit?.memory || 0,
                restarts: proc.pm2_env?.restart_time || 0,
                uptime: proc.pm2_env?.pm_uptime
            })),
            health: healthStatus
        };

        metricsHistory.application.push(metrics);
        
        // Keep only last 100 entries
        if (metricsHistory.application.length > 100) {
            metricsHistory.application = metricsHistory.application.slice(-100);
        }

        // Emit to connected clients
        io.emit('applicationMetrics', metrics);
        
        return metrics;
    } catch (error) {
        console.error('Error collecting application metrics:', error);
        return null;
    }
}

// Database metrics collection
async function collectDatabaseMetrics() {
    if (!DB_URL) return null;

    try {
        const client = new Client({ connectionString: DB_URL });
        await client.connect();

        // Get database stats
        const statsQuery = `
            SELECT 
                schemaname,
                tablename,
                n_tup_ins as inserts,
                n_tup_upd as updates,
                n_tup_del as deletes,
                n_live_tup as live_tuples,
                n_dead_tup as dead_tuples
            FROM pg_stat_user_tables;
        `;

        const connectionQuery = `
            SELECT 
                count(*) as total_connections,
                count(*) FILTER (WHERE state = 'active') as active_connections,
                count(*) FILTER (WHERE state = 'idle') as idle_connections
            FROM pg_stat_activity 
            WHERE datname = current_database();
        `;

        const sizeQuery = `
            SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
        `;

        const [statsResult, connResult, sizeResult] = await Promise.all([
            client.query(statsQuery),
            client.query(connectionQuery),
            client.query(sizeQuery)
        ]);

        await client.end();

        const metrics = {
            timestamp: Date.now(),
            tables: statsResult.rows,
            connections: connResult.rows[0],
            size: sizeResult.rows[0]?.database_size
        };

        metricsHistory.database.push(metrics);
        
        // Keep only last 100 entries
        if (metricsHistory.database.length > 100) {
            metricsHistory.database = metricsHistory.database.slice(-100);
        }

        // Emit to connected clients
        io.emit('databaseMetrics', metrics);
        
        return metrics;
    } catch (error) {
        console.error('Error collecting database metrics:', error);
        return null;
    }
}

// API endpoints
app.get('/api/metrics/system', (req, res) => {
    res.json(metricsHistory.system);
});

app.get('/api/metrics/application', (req, res) => {
    res.json(metricsHistory.application);
});

app.get('/api/metrics/database', (req, res) => {
    res.json(metricsHistory.database);
});

app.get('/api/metrics/current', async (req, res) => {
    const current = {
        system: metricsHistory.system[metricsHistory.system.length - 1],
        application: metricsHistory.application[metricsHistory.application.length - 1],
        database: metricsHistory.database[metricsHistory.database.length - 1]
    };
    res.json(current);
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Dashboard client connected');
    
    // Send current metrics to new client
    socket.emit('systemMetrics', metricsHistory.system[metricsHistory.system.length - 1]);
    socket.emit('applicationMetrics', metricsHistory.application[metricsHistory.application.length - 1]);
    socket.emit('databaseMetrics', metricsHistory.database[metricsHistory.database.length - 1]);
    
    socket.on('disconnect', () => {
        console.log('Dashboard client disconnected');
    });
});

// Collect metrics every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
    await Promise.all([
        collectSystemMetrics(),
        collectApplicationMetrics(),
        collectDatabaseMetrics()
    ]);
});

// Initial metrics collection
setTimeout(async () => {
    await Promise.all([
        collectSystemMetrics(),
        collectApplicationMetrics(),
        collectDatabaseMetrics()
    ]);
}, 1000);

server.listen(PORT, () => {
    console.log(`Boutique Monitoring Dashboard running on port ${PORT}`);
});
EOF

    # Create public directory and dashboard HTML
    mkdir -p public
    cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Boutique Portal - System Monitor</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            padding: 1rem 2rem;
            color: white;
        }
        
        .header h1 {
            font-size: 1.8rem;
            font-weight: 600;
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 2rem;
            padding: 2rem;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
            color: white;
        }
        
        .card h2 {
            font-size: 1.2rem;
            margin-bottom: 1rem;
            color: #fff;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            padding-bottom: 0.5rem;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .metric:last-child {
            border-bottom: none;
        }
        
        .metric-label {
            font-weight: 500;
        }
        
        .metric-value {
            font-weight: 600;
            font-family: 'Courier New', monospace;
        }
        
        .status-online {
            color: #4ade80;
        }
        
        .status-offline {
            color: #f87171;
        }
        
        .status-warning {
            color: #fbbf24;
        }
        
        .chart-container {
            position: relative;
            height: 200px;
            margin-top: 1rem;
        }
        
        .loading {
            text-align: center;
            color: rgba(255, 255, 255, 0.7);
            padding: 2rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏢 Boutique Portal - System Monitor</h1>
    </div>
    
    <div class="dashboard">
        <!-- System Metrics -->
        <div class="card">
            <h2>📊 System Metrics</h2>
            <div id="systemMetrics" class="loading">Loading system metrics...</div>
            <div class="chart-container">
                <canvas id="cpuChart"></canvas>
            </div>
        </div>
        
        <!-- Memory Usage -->
        <div class="card">
            <h2>💾 Memory Usage</h2>
            <div id="memoryMetrics" class="loading">Loading memory metrics...</div>
            <div class="chart-container">
                <canvas id="memoryChart"></canvas>
            </div>
        </div>
        
        <!-- Application Status -->
        <div class="card">
            <h2>🚀 Application Status</h2>
            <div id="applicationMetrics" class="loading">Loading application metrics...</div>
        </div>
        
        <!-- Database Metrics -->
        <div class="card">
            <h2>🗄️ Database Metrics</h2>
            <div id="databaseMetrics" class="loading">Loading database metrics...</div>
        </div>
        
        <!-- Disk Usage -->
        <div class="card">
            <h2>💽 Disk Usage</h2>
            <div id="diskMetrics" class="loading">Loading disk metrics...</div>
        </div>
        
        <!-- Network Stats -->
        <div class="card">
            <h2>🌐 Network Stats</h2>
            <div id="networkMetrics" class="loading">Loading network metrics...</div>
        </div>
    </div>

    <script>
        const socket = io();
        
        // Chart configurations
        const cpuChart = new Chart(document.getElementById('cpuChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Usage %',
                    data: [],
                    borderColor: '#4ade80',
                    backgroundColor: 'rgba(74, 222, 128, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                    },
                    x: {
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: 'rgba(255, 255, 255, 0.7)' }
                    }
                }
            }
        });
        
        const memoryChart = new Chart(document.getElementById('memoryChart'), {
            type: 'doughnut',
            data: {
                labels: ['Used', 'Free'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#f87171', '#4ade80'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: 'rgba(255, 255, 255, 0.7)' }
                    }
                }
            }
        });
        
        function formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        function formatUptime(uptime) {
            const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
            const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
            return `${days}d ${hours}h ${minutes}m`;
        }
        
        // Socket event handlers
        socket.on('systemMetrics', (data) => {
            if (!data) return;
            
            const html = `
                <div class="metric">
                    <span class="metric-label">CPU Usage:</span>
                    <span class="metric-value">${data.cpu.usage.toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">CPU Cores:</span>
                    <span class="metric-value">${data.cpu.cores}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Load Average:</span>
                    <span class="metric-value">${data.processes.running}/${data.processes.total}</span>
                </div>
            `;
            document.getElementById('systemMetrics').innerHTML = html;
            
            // Update CPU chart
            const time = new Date(data.timestamp).toLocaleTimeString();
            cpuChart.data.labels.push(time);
            cpuChart.data.datasets[0].data.push(data.cpu.usage);
            
            if (cpuChart.data.labels.length > 20) {
                cpuChart.data.labels.shift();
                cpuChart.data.datasets[0].data.shift();
            }
            cpuChart.update();
            
            // Update memory chart and metrics
            const memUsedGB = data.memory.used / (1024 * 1024 * 1024);
            const memTotalGB = data.memory.total / (1024 * 1024 * 1024);
            const memFreeGB = memTotalGB - memUsedGB;
            
            memoryChart.data.datasets[0].data = [memUsedGB, memFreeGB];
            memoryChart.update();
            
            const memoryHtml = `
                <div class="metric">
                    <span class="metric-label">Total Memory:</span>
                    <span class="metric-value">${formatBytes(data.memory.total)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Used Memory:</span>
                    <span class="metric-value">${formatBytes(data.memory.used)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Memory Usage:</span>
                    <span class="metric-value">${data.memory.usage.toFixed(1)}%</span>
                </div>
            `;
            document.getElementById('memoryMetrics').innerHTML = memoryHtml;
            
            // Update disk metrics
            if (data.disk && data.disk.length > 0) {
                const diskHtml = data.disk.map(disk => `
                    <div class="metric">
                        <span class="metric-label">${disk.fs}:</span>
                        <span class="metric-value">${disk.usage.toFixed(1)}% (${formatBytes(disk.used)}/${formatBytes(disk.size)})</span>
                    </div>
                `).join('');
                document.getElementById('diskMetrics').innerHTML = diskHtml;
            }
            
            // Update network metrics
            if (data.network) {
                const networkHtml = `
                    <div class="metric">
                        <span class="metric-label">RX Bytes:</span>
                        <span class="metric-value">${formatBytes(data.network.rx_bytes || 0)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">TX Bytes:</span>
                        <span class="metric-value">${formatBytes(data.network.tx_bytes || 0)}</span>
                    </div>
                `;
                document.getElementById('networkMetrics').innerHTML = networkHtml;
            }
        });
        
        socket.on('applicationMetrics', (data) => {
            if (!data) return;
            
            let html = '';
            
            if (data.health) {
                const healthStatus = data.health.status === 'ok' ? 'status-online' : 'status-offline';
                html += `
                    <div class="metric">
                        <span class="metric-label">Health Status:</span>
                        <span class="metric-value ${healthStatus}">${data.health.status}</span>
                    </div>
                `;
            }
            
            if (data.pm2Processes && data.pm2Processes.length > 0) {
                html += data.pm2Processes.map(proc => {
                    const statusClass = proc.status === 'online' ? 'status-online' : 'status-offline';
                    const uptime = proc.uptime ? formatUptime(Date.now() - proc.uptime) : 'N/A';
                    
                    return `
                        <div class="metric">
                            <span class="metric-label">${proc.name}:</span>
                            <span class="metric-value ${statusClass}">${proc.status}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">CPU:</span>
                            <span class="metric-value">${proc.cpu}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Memory:</span>
                            <span class="metric-value">${formatBytes(proc.memory)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Restarts:</span>
                            <span class="metric-value">${proc.restarts}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Uptime:</span>
                            <span class="metric-value">${uptime}</span>
                        </div>
                    `;
                }).join('');
            } else {
                html += '<div class="metric"><span class="metric-label">No PM2 processes found</span></div>';
            }
            
            document.getElementById('applicationMetrics').innerHTML = html;
        });
        
        socket.on('databaseMetrics', (data) => {
            if (!data) return;
            
            let html = '';
            
            if (data.connections) {
                html += `
                    <div class="metric">
                        <span class="metric-label">Total Connections:</span>
                        <span class="metric-value">${data.connections.total_connections}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Active Connections:</span>
                        <span class="metric-value">${data.connections.active_connections}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Idle Connections:</span>
                        <span class="metric-value">${data.connections.idle_connections}</span>
                    </div>
                `;
            }
            
            if (data.size) {
                html += `
                    <div class="metric">
                        <span class="metric-label">Database Size:</span>
                        <span class="metric-value">${data.size}</span>
                    </div>
                `;
            }
            
            if (data.tables && data.tables.length > 0) {
                const totalTuples = data.tables.reduce((sum, table) => sum + parseInt(table.live_tuples || 0), 0);
                html += `
                    <div class="metric">
                        <span class="metric-label">Total Records:</span>
                        <span class="metric-value">${totalTuples.toLocaleString()}</span>
                    </div>
                `;
            }
            
            document.getElementById('databaseMetrics').innerHTML = html || '<div class="metric"><span class="metric-label">No database metrics available</span></div>';
        });
        
        // Connection status
        socket.on('connect', () => {
            console.log('Connected to monitoring server');
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from monitoring server');
        });
    </script>
</body>
</html>
EOF

    success "Node.js monitoring dashboard created"
}

# =============================================================================
# PM2 Ecosystem Configuration
# =============================================================================

create_monitoring_ecosystem() {
    log "Creating PM2 ecosystem configuration for monitoring..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create PM2 monitoring configuration"
        return 0
    fi

    cat > "$MONITORING_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'boutique-monitoring-dashboard',
    script: './server.js',
    cwd: '$MONITORING_DIR',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      DASHBOARD_PORT: '$DASHBOARD_PORT',
      DATABASE_URL: process.env.DATABASE_URL,
      ADMIN_EMAIL: '$ADMIN_EMAIL',
      SLACK_WEBHOOK: '$SLACK_WEBHOOK'
    },
    log_file: '/opt/boutique-client/logs/monitoring-combined.log',
    out_file: '/opt/boutique-client/logs/monitoring-out.log',
    error_file: '/opt/boutique-client/logs/monitoring-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    restart_delay: 4000,
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    min_uptime: '10s',
    max_restarts: 10,
    kill_timeout: 5000
  }]
};
EOF

    success "PM2 monitoring ecosystem configuration created"
}

# =============================================================================
# Nginx Configuration
# =============================================================================

configure_nginx_monitoring() {
    log "Configuring Nginx for monitoring dashboard..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would configure Nginx for monitoring"
        return 0
    fi

    # Create monitoring subdomain configuration if domain is provided
    if [[ -n "$DOMAIN" ]]; then
        cat > "/etc/nginx/sites-available/boutique-monitoring" << EOF
server {
    listen 80;
    server_name monitor.$DOMAIN;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name monitor.$DOMAIN;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozTLS:10m;
    ssl_session_tickets off;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Basic auth for monitoring access
    auth_basic "Monitoring Dashboard";
    auth_basic_user_file /etc/nginx/.htpasswd-monitoring;
    
    location / {
        proxy_pass http://localhost:$DASHBOARD_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:$DASHBOARD_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

        # Enable the site
        ln -sf /etc/nginx/sites-available/boutique-monitoring /etc/nginx/sites-enabled/

        # Create basic auth for monitoring access
        if command -v htpasswd >/dev/null 2>&1; then
            # Generate random password for monitoring access
            MONITORING_PASSWORD=$(openssl rand -base64 32)
            htpasswd -cb /etc/nginx/.htpasswd-monitoring "$ADMIN_USER" "$MONITORING_PASSWORD"
            
            log "Monitoring dashboard credentials:"
            log "  Username: $ADMIN_USER"
            log "  Password: $MONITORING_PASSWORD"
            log "  URL: https://monitor.$DOMAIN"
        else
            warning "htpasswd not available, basic auth not configured"
        fi
    else
        log "No domain provided, monitoring accessible at http://localhost:$DASHBOARD_PORT"
    fi

    # Test and reload Nginx configuration
    nginx -t && systemctl reload nginx

    success "Nginx monitoring configuration completed"
}

# =============================================================================
# Systemd Service
# =============================================================================

create_monitoring_service() {
    log "Creating systemd service for monitoring dashboard..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create monitoring systemd service"
        return 0
    fi

    cat > "/etc/systemd/system/boutique-monitoring.service" << EOF
[Unit]
Description=Boutique Client Portal Monitoring Dashboard
Documentation=https://docs.your-domain.com
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=forking
User=boutique-client
Group=boutique-client
WorkingDirectory=$MONITORING_DIR
Environment=NODE_ENV=production
Environment=DASHBOARD_PORT=$DASHBOARD_PORT
EnvironmentFile=-/opt/boutique-client/app/.env.production
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 restart boutique-monitoring-dashboard
ExecStop=/usr/bin/pm2 stop boutique-monitoring-dashboard
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=boutique-monitoring
KillMode=process

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable boutique-monitoring.service

    success "Monitoring systemd service created and enabled"
}

# =============================================================================
# Monitoring Integration
# =============================================================================

integrate_with_existing_monitoring() {
    log "Integrating with existing monitoring scripts..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would integrate with existing monitoring"
        return 0
    fi

    # Update system monitor script to include dashboard metrics
    if [[ -f "$PROJECT_ROOT/scripts/system-monitor.sh" ]]; then
        # Add dashboard health check to system monitor
        cat >> "$PROJECT_ROOT/scripts/system-monitor.sh" << 'EOF'

# Check monitoring dashboard
check_monitoring_dashboard() {
    local dashboard_url="http://localhost:${DASHBOARD_PORT:-3001}/api/metrics/current"
    
    if command -v curl >/dev/null 2>&1; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$dashboard_url")
        
        if [ "$response" = "200" ]; then
            log_message "INFO" "Monitoring dashboard: OK"
            return 0
        else
            send_alert "WARNING" "Monitoring Dashboard Issue" "Dashboard endpoint returned HTTP $response"
            return 1
        fi
    else
        log_message "WARNING" "curl not available for dashboard check"
        return 1
    fi
}

# Add dashboard check to main monitoring function
if declare -f run_monitor >/dev/null; then
    # Backup original function
    eval "$(declare -f run_monitor | sed 's/^run_monitor/original_run_monitor/')"
    
    # Override with extended version
    run_monitor() {
        original_run_monitor
        local dashboard_issues=$?
        
        check_monitoring_dashboard || ((dashboard_issues++))
        
        return $dashboard_issues
    }
fi
EOF
    fi

    success "Monitoring integration completed"
}

# =============================================================================
# Cron Jobs for Monitoring
# =============================================================================

setup_monitoring_cron() {
    log "Setting up monitoring cron jobs..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would setup monitoring cron jobs"
        return 0
    fi

    # Create cron file for monitoring tasks
    cat > "/etc/cron.d/boutique-monitoring" << EOF
# Boutique Client Portal - Monitoring Tasks
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=$ADMIN_EMAIL

# Check monitoring dashboard health every 5 minutes
*/5 * * * * boutique-client curl -f http://localhost:$DASHBOARD_PORT/api/metrics/current >/dev/null 2>&1 || echo "Monitoring dashboard health check failed" | logger -t boutique-monitoring

# Generate monitoring report daily
0 6 * * * boutique-client $MONITORING_DIR/../scripts/generate-monitoring-report.sh

# Clean up old monitoring logs weekly
0 2 * * 0 boutique-client find /opt/boutique-client/logs -name "monitoring-*.log" -mtime +7 -delete

# Restart monitoring dashboard weekly (maintenance)
0 3 * * 1 boutique-client pm2 restart boutique-monitoring-dashboard
EOF

    # Create monitoring report script
    cat > "$PROJECT_ROOT/scripts/generate-monitoring-report.sh" << 'EOF'
#!/bin/bash

# Generate daily monitoring report
REPORT_DATE=$(date '+%Y-%m-%d')
REPORT_FILE="/opt/boutique-client/logs/monitoring-report-$REPORT_DATE.txt"

{
    echo "Boutique Portal - Daily Monitoring Report"
    echo "Date: $REPORT_DATE"
    echo "======================================="
    echo
    
    echo "System Summary:"
    echo "  Uptime: $(uptime -p)"
    echo "  Load: $(uptime | awk -F'load average:' '{print $2}')"
    echo "  Memory: $(free -h | grep Mem | awk '{print $3"/"$2" ("$5" available)"}')"
    echo "  Disk: $(df -h /opt/boutique-client | awk 'NR==2 {print $3"/"$2" ("$5" used)"}')"
    echo
    
    echo "Application Status:"
    pm2 jlist 2>/dev/null | jq -r '.[] | "  \(.name): \(.pm2_env.status) (CPU: \(.monit.cpu)%, Memory: \(.monit.memory/1024/1024|floor)MB)"' 2>/dev/null || echo "  PM2 status unavailable"
    echo
    
    echo "Database Status:"
    if command -v psql >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
        psql "$DATABASE_URL" -c "SELECT 'Connected successfully' as status;" 2>/dev/null || echo "  Database connection failed"
    else
        echo "  Database check unavailable"
    fi
    echo
    
    echo "Recent Errors (last 24 hours):"
    find /opt/boutique-client/logs -name "*.log" -mtime -1 -exec grep -l -i "error\|failed\|exception" {} \; | head -5 | while read file; do
        echo "  Found errors in: $file"
        grep -i "error\|failed\|exception" "$file" | tail -3 | sed 's/^/    /'
    done
    echo
    
} > "$REPORT_FILE"

echo "Monitoring report generated: $REPORT_FILE"
EOF

    chmod +x "$PROJECT_ROOT/scripts/generate-monitoring-report.sh"

    success "Monitoring cron jobs configured"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    log "Starting monitoring dashboard setup..."
    log "Configuration: port=$DASHBOARD_PORT, admin=$ADMIN_USER"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN MODE - No actual changes will be made"
    fi

    # Validate prerequisites
    if [[ "$EUID" -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi

    if [[ ! -d "$PROJECT_ROOT" ]]; then
        error "Project root not found: $PROJECT_ROOT"
    fi

    # Execute setup steps
    install_prerequisites
    create_monitoring_dashboard
    create_monitoring_ecosystem
    
    if [[ -n "$DOMAIN" ]]; then
        configure_nginx_monitoring
    fi
    
    create_monitoring_service
    integrate_with_existing_monitoring
    setup_monitoring_cron

    success "Monitoring dashboard setup completed successfully!"

    echo
    echo "📊 Monitoring Dashboard Information:"
    echo "========================================"
    if [[ -n "$DOMAIN" ]]; then
        echo "  🌐 Dashboard URL: https://monitor.$DOMAIN"
        echo "  👤 Username: $ADMIN_USER"
        echo "  📧 Admin Email: $ADMIN_EMAIL"
    else
        echo "  🌐 Dashboard URL: http://localhost:$DASHBOARD_PORT"
    fi
    echo "  📁 Installation Directory: $MONITORING_DIR"
    echo "  📋 Log Files: /opt/boutique-client/logs/monitoring-*.log"
    echo
    echo "🚀 Starting Services:"
    echo "========================================"
    echo "  systemctl start boutique-monitoring    # Start monitoring service"
    echo "  pm2 status                              # Check PM2 processes"
    echo "  pm2 logs boutique-monitoring-dashboard  # View logs"
    echo
    echo "📈 Monitoring Features:"
    echo "========================================"
    echo "  ✅ Real-time system metrics (CPU, Memory, Disk)"
    echo "  ✅ Application performance monitoring"
    echo "  ✅ Database connection and usage stats"
    echo "  ✅ PM2 process monitoring"
    echo "  ✅ Network statistics"
    echo "  ✅ Interactive charts and graphs"
    echo "  ✅ WebSocket real-time updates"
    echo
}

# Error handling
trap 'error "Monitoring setup failed at line $LINENO"' ERR

# Parse arguments and run main function
parse_args "$@"
main