# Incident Response Procedures - Boutique Client Portal

## Overview

This document outlines the incident response procedures for the Boutique Client Portal production environment. It provides structured approaches to identify, contain, analyze, and resolve production incidents while maintaining service availability and data integrity.

## Incident Classification

### Severity Levels

#### P0 - Critical (Service Down)
- **Response Time**: Immediate (< 15 minutes)
- **Examples**: 
  - Complete service outage
  - Database corruption or unavailability
  - Security breach or data compromise
  - Authentication system failure
- **Escalation**: All hands on deck, notify stakeholders immediately

#### P1 - High (Major Impact)
- **Response Time**: 1 hour
- **Examples**:
  - Significant performance degradation (>50% slower)
  - Core features unavailable
  - SSL certificate issues
  - Memory leaks causing instability
- **Escalation**: Senior team members, business stakeholders

#### P2 - Medium (Moderate Impact)
- **Response Time**: 4 hours (business hours), 8 hours (off-hours)
- **Examples**:
  - Minor feature failures
  - Intermittent errors affecting <25% of users
  - Non-critical integrations failing
- **Escalation**: On-call engineer, team lead

#### P3 - Low (Minor Impact)
- **Response Time**: 24 hours
- **Examples**:
  - Cosmetic issues
  - Documentation problems
  - Non-critical alerts
- **Escalation**: Regular team queue

## Incident Response Team

### Roles and Responsibilities

#### Incident Commander (IC)
- **Primary Contact**: [Primary Engineer]
- **Backup**: [Secondary Engineer]
- **Responsibilities**:
  - Overall incident coordination
  - Decision making and communication
  - Resource allocation
  - Post-incident review scheduling

#### Technical Lead
- **Responsibilities**:
  - Technical investigation and resolution
  - Implementation of fixes
  - System restoration verification

#### Communications Lead
- **Responsibilities**:
  - Stakeholder communication
  - Status page updates
  - Internal team updates
  - Customer communication

#### Subject Matter Experts (SMEs)
- **Database Expert**: Database-related issues
- **Security Expert**: Security incidents
- **Infrastructure Expert**: Server and network issues
- **Application Expert**: Application logic and business rules

### Contact Information

```
🚨 EMERGENCY CONTACTS
===================
Primary On-Call: [Phone] / [Email]
Secondary On-Call: [Phone] / [Email]
Management: [Phone] / [Email]
Database Admin: [Phone] / [Email]

📧 ESCALATION EMAIL: incidents@yourdomain.com
📱 SLACK CHANNEL: #incidents
📞 CONFERENCE BRIDGE: [Conference Number]
```

## Incident Response Process

### Phase 1: Detection and Alerting (0-5 minutes)

#### Automatic Detection
- **Monitoring Alerts**: System monitor triggers alert
- **Health Check Failures**: Application health endpoints fail
- **Error Rate Spikes**: Application error rates exceed thresholds
- **Performance Degradation**: Response times exceed acceptable limits

#### Manual Detection
- **User Reports**: Customer or internal user reports
- **Team Member Discovery**: Engineer notices issues during routine work

#### Initial Actions
1. **Acknowledge Alert** (within 5 minutes)
   ```bash
   # Check system status immediately
   ./scripts/system-monitor.sh --summary
   ```

2. **Assess Severity**
   ```bash
   # Quick health check
   curl -f https://yourdomain.com/api/admin/health
   pm2 status
   ```

3. **Create Incident Record**
   - Document in incident tracking system
   - Assign incident ID and severity level
   - Set initial status to "Investigating"

### Phase 2: Response and Triage (5-15 minutes)

#### Immediate Response Actions

1. **Assemble Response Team**
   ```bash
   # Send initial alert
   echo "INCIDENT: P[0-3] - [Brief Description]
   Incident ID: INC-$(date +%Y%m%d-%H%M%S)
   Started: $(date)
   Status: Investigating
   IC: [Name]
   
   Join incident channel: #incident-$(date +%Y%m%d)
   Conference: [Number]" | mail -s "INCIDENT ALERT" incidents@yourdomain.com
   ```

2. **Initial Assessment**
   ```bash
   # System health check
   ./scripts/system-monitor.sh
   
   # Application logs
   pm2 logs boutique-client-portal --lines 100 | grep -i error
   
   # Database connectivity
   npx prisma db execute --stdin <<< "SELECT 1;"
   
   # Recent deployments
   git log --oneline -10
   ```

3. **Communication Setup**
   - Create dedicated Slack channel: `#incident-YYYYMMDD`
   - Start conference bridge
   - Notify stakeholders based on severity level

#### Triage Decision Tree

```
Is service completely down?
├── YES → P0 - Implement immediate fallback/rollback
└── NO
    └── Is core functionality affected?
        ├── YES → P1 - Investigate core systems
        └── NO
            └── Are multiple users affected?
                ├── YES → P2 - Standard investigation
                └── NO → P3 - Queue for next business day
```

### Phase 3: Investigation and Diagnosis (15-60 minutes)

#### Systematic Investigation

1. **Recent Changes Analysis**
   ```bash
   # Check recent deployments
   git log --since="24 hours ago" --oneline
   
   # Check configuration changes
   find /opt/boutique-client -name "*.env*" -o -name "*.config.*" -mtime -1
   
   # Check system updates
   grep "$(date +%Y-%m-%d)" /var/log/dpkg.log
   ```

2. **System Resource Analysis**
   ```bash
   # CPU and Memory usage
   ./scripts/system-monitor.sh --check-only
   
   # Disk space
   df -h
   
   # Network connectivity
   netstat -tuln | grep LISTEN
   ```

3. **Application Analysis**
   ```bash
   # PM2 process status
   pm2 status
   pm2 describe boutique-client-portal
   
   # Application logs with timestamps
   pm2 logs boutique-client-portal --timestamp --lines 200
   
   # Error patterns
   grep -E "(error|exception|failed)" /opt/boutique-client/logs/*.log | tail -50
   ```

4. **Database Analysis**
   ```bash
   # Database connectivity and performance
   psql "$DATABASE_URL" -c "
   SELECT 
     count(*) as total_connections,
     count(*) FILTER (WHERE state = 'active') as active_connections,
     count(*) FILTER (WHERE state = 'idle') as idle_connections,
     pg_size_pretty(pg_database_size(current_database())) as db_size
   FROM pg_stat_activity 
   WHERE datname = current_database();"
   
   # Recent database errors
   tail -100 /var/log/postgresql/postgresql-*.log | grep ERROR
   ```

#### Root Cause Analysis Framework

1. **Timeline Reconstruction**
   - When did the incident start?
   - What changed around that time?
   - What was the progression of symptoms?

2. **Impact Assessment**
   - How many users are affected?
   - Which features are impacted?
   - What is the business impact?

3. **Technical Investigation**
   - System resources (CPU, memory, disk, network)
   - Application errors and exceptions
   - Database performance and connectivity
   - External dependencies

### Phase 4: Containment and Mitigation (Immediate)

#### Immediate Actions by Severity

##### P0 - Critical Incidents
```bash
# Option 1: Quick rollback (if recent deployment)
git log --oneline -5
./scripts/disaster-recovery.sh --scenario=rollback --rollback-to=TIMESTAMP

# Option 2: Service restart
pm2 restart boutique-client-portal

# Option 3: Fallback mode (if available)
# Enable maintenance mode
echo "Service temporarily unavailable" > /opt/boutique-client/public/maintenance.html
```

##### P1 - High Priority Incidents
```bash
# Graceful degradation
pm2 restart boutique-client-portal --update-env

# Scale resources if needed
# (If using cloud infrastructure)

# Isolate problematic components
pm2 stop boutique-websocket-server  # If websocket issues
```

##### P2/P3 - Lower Priority Incidents
- Monitor and prepare fixes for next deployment window
- Implement workarounds if available
- Document issues for regular maintenance

#### Communication During Containment

1. **Internal Updates** (Every 15-30 minutes for P0/P1)
   ```
   UPDATE - INC-YYYYMMDD-HHMM
   Time: [Current Time]
   Status: [Investigating/Mitigating/Resolved]
   Impact: [Current Impact]
   Actions: [What we're doing]
   ETA: [Expected resolution time]
   Next Update: [When next update will be sent]
   ```

2. **External Communication** (For customer-facing incidents)
   - Update status page
   - Notify affected customers
   - Provide workarounds if available

### Phase 5: Resolution and Recovery

#### Resolution Steps

1. **Implement Fix**
   ```bash
   # Apply the identified solution
   # Examples:
   
   # Code fix deployment
   git pull origin main
   npm run build
   pm2 restart boutique-client-portal
   
   # Configuration fix
   vi /opt/boutique-client/app/.env.production
   pm2 restart boutique-client-portal --update-env
   
   # Database fix
   npx prisma migrate deploy
   ```

2. **Verification Testing**
   ```bash
   # Health checks
   curl -f https://yourdomain.com/api/admin/health
   
   # Key functionality tests
   curl -f https://yourdomain.com/login
   curl -f https://yourdomain.com/api/auth/me
   
   # Performance verification
   curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/
   ```

3. **System Monitoring**
   ```bash
   # Monitor for 30 minutes after fix
   watch -n 30 './scripts/system-monitor.sh --summary'
   
   # Monitor application logs
   pm2 logs boutique-client-portal --timestamp
   ```

#### Recovery Validation Checklist

- [ ] All systems responding normally
- [ ] Key functionality working
- [ ] Performance metrics within normal ranges
- [ ] No error spikes in logs
- [ ] Database operating normally
- [ ] External integrations functioning
- [ ] User authentication working
- [ ] Critical user journeys tested

### Phase 6: Post-Incident Activities

#### Immediate Post-Resolution (Within 1 hour)

1. **Final Communications**
   ```
   RESOLVED - INC-YYYYMMDD-HHMM
   Time: [Resolution Time]
   Duration: [Total Incident Duration]
   Root Cause: [Brief Description]
   Resolution: [What was done]
   Monitoring: [Ongoing monitoring status]
   Post-Mortem: [When it will be conducted]
   ```

2. **Documentation Update**
   - Update incident record with final status
   - Document timeline of events
   - Record actions taken and their outcomes

#### Post-Incident Review (Within 72 hours)

1. **Schedule Review Meeting**
   - Include all key participants
   - Book 60-90 minutes
   - Prepare materials in advance

2. **Review Agenda Template**
   ```
   Incident Post-Mortem: INC-YYYYMMDD-HHMM
   
   1. Incident Overview (10 min)
      - What happened?
      - Impact and duration
   
   2. Timeline Review (20 min)
      - Detection to resolution
      - Key decisions and actions
   
   3. Root Cause Analysis (20 min)
      - Technical root cause
      - Contributing factors
   
   4. Response Analysis (15 min)
      - What went well?
      - What could be improved?
   
   5. Action Items (15 min)
      - Prevention measures
      - Process improvements
      - Tool/automation needs
   ```

3. **Action Item Tracking**
   - Assign owners and due dates
   - Track completion
   - Update procedures and runbooks

## Incident-Specific Procedures

### Database Incidents

#### Symptoms
- Database connection failures
- Query timeouts
- Data inconsistencies
- Slow query performance

#### Investigation Steps
```bash
# Check database status
systemctl status postgresql

# Check connections
psql "$DATABASE_URL" -c "SELECT * FROM pg_stat_activity;"

# Check database size and performance
psql "$DATABASE_URL" -c "
SELECT 
  schemaname,
  tablename,
  n_tup_ins + n_tup_upd + n_tup_del as total_writes,
  n_tup_upd + n_tup_del as modifications,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stat_user_tables 
ORDER BY total_writes DESC LIMIT 10;
"

# Check for locks
psql "$DATABASE_URL" -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

#### Resolution Actions
```bash
# Restart database service (last resort)
sudo systemctl restart postgresql

# Kill problematic queries
psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"

# Restore from backup (if corruption)
./scripts/disaster-recovery.sh --scenario=db-restore --backup-date=$(date -d yesterday +%Y-%m-%d)
```

### Application Performance Issues

#### Symptoms
- High response times
- Memory leaks
- CPU spikes
- User complaints about slowness

#### Investigation Steps
```bash
# Check PM2 metrics
pm2 monit

# Memory analysis
ps aux --sort=-%mem | head -10

# CPU analysis
top -bn1 | head -20

# Application profiling
pm2 profile:cpu 30  # Profile for 30 seconds
```

#### Resolution Actions
```bash
# Restart application
pm2 restart boutique-client-portal

# Scale up (if possible)
pm2 scale boutique-client-portal +1

# Memory optimization
pm2 restart boutique-client-portal --max-memory-restart 400M
```

### Security Incidents

#### Symptoms
- Unusual authentication attempts
- Suspicious database queries
- Unexpected file modifications
- Security alerts from monitoring

#### Immediate Actions
```bash
# Check authentication logs
grep "Failed password" /var/log/auth.log | tail -20

# Check fail2ban status
sudo fail2ban-client status sshd

# Check application audit logs
psql "$DATABASE_URL" -c "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20;"

# Force logout all users (if needed)
psql "$DATABASE_URL" -c "DELETE FROM Session;"
```

#### Investigation and Response
1. **Isolate the threat** - Block suspicious IPs
2. **Assess the damage** - Review audit logs and database changes
3. **Secure the environment** - Update passwords, revoke tokens
4. **Document everything** - Preserve logs and evidence
5. **Notify authorities** - If required by compliance/law

### Infrastructure Incidents

#### Symptoms
- Server unresponsive
- Network connectivity issues
- File system problems
- SSL certificate issues

#### Investigation Steps
```bash
# System resources
df -h
free -h
uptime

# Network connectivity
ping 8.8.8.8
netstat -tuln

# SSL certificate
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -text -noout | grep "Not After"

# File system issues
dmesg | tail -20
mount | grep /opt/boutique-client
```

## Incident Communication Templates

### Initial Alert Template
```
🚨 INCIDENT ALERT 🚨
Severity: P[0-3]
ID: INC-$(date +%Y%m%d-%H%M%S)
Started: $(date)

Description: [Brief description of the incident]
Impact: [Who/what is affected]
Status: Investigating

Incident Commander: [Name]
Join: #incident-$(date +%Y%m%d)
Next Update: [Time]
```

### Status Update Template
```
📊 INCIDENT UPDATE 📊
ID: INC-YYYYMMDD-HHMM
Time: [Current Time]
Duration: [How long since incident started]

Status: [Investigating/Mitigating/Resolved]
Current Impact: [What's still affected]
Actions Taken: [What we've done so far]
Next Steps: [What we're doing next]

ETA for Resolution: [Best estimate]
Next Update: [When next update will be sent]
```

### Resolution Template
```
✅ INCIDENT RESOLVED ✅
ID: INC-YYYYMMDD-HHMM
Resolved: $(date)
Duration: [Total incident duration]

Root Cause: [Brief explanation]
Resolution: [What was done to fix it]
Impact: [Final impact summary]

Monitoring: Service is being monitored for stability
Post-Mortem: Scheduled for [Date/Time]

Thank you for your patience during this incident.
```

## Tools and Resources

### Essential Commands
```bash
# Quick system check
./scripts/system-monitor.sh --summary

# Application status
pm2 status && pm2 logs --lines 20

# Database health
npx prisma db execute --stdin <<< "SELECT 1;"

# Recent changes
git log --oneline --since="24 hours ago"

# Resource usage
top -bn1 | head -10 && free -h && df -h
```

### Useful Log Locations
- **Application Logs**: `/opt/boutique-client/logs/`
- **PM2 Logs**: `~/.pm2/logs/`
- **System Logs**: `/var/log/syslog`
- **Nginx Logs**: `/var/log/nginx/`
- **PostgreSQL Logs**: `/var/log/postgresql/`
- **Security Logs**: `/var/log/auth.log`

### External Resources
- **Status Page**: [Your Status Page URL]
- **Documentation**: [Your Documentation URL]
- **Monitoring Dashboard**: [Your Monitoring URL]
- **Incident Tracking**: [Your Incident Management System]

## Continuous Improvement

### Incident Metrics to Track
- Mean Time to Detection (MTTD)
- Mean Time to Resolution (MTTR)
- Incident frequency by category
- Customer impact duration
- Resolution effectiveness

### Regular Review Process
- **Monthly**: Review incident trends and metrics
- **Quarterly**: Update procedures based on lessons learned
- **Annually**: Comprehensive review of incident response capability

### Training and Preparedness
- **Incident Response Drills**: Quarterly tabletop exercises
- **New Team Member Training**: Incident response procedures
- **Documentation Updates**: Keep procedures current
- **Tool Familiarization**: Regular training on monitoring and diagnostic tools

---

## Emergency Contact Card

```
💳 EMERGENCY CONTACT CARD 💳
Keep this information readily available

PRIMARY ON-CALL: [Phone] / [Email]
BACKUP ON-CALL: [Phone] / [Email]
ESCALATION: [Manager Phone] / [Email]

INCIDENT EMAIL: incidents@yourdomain.com
SLACK CHANNEL: #incidents
CONFERENCE: [Bridge Number]

MONITORING: [Dashboard URL]
STATUS PAGE: [Status Page URL]
RUNBOOK: /opt/boutique-client/DEPLOYMENT-RUNBOOK.md

QUICK COMMANDS:
./scripts/system-monitor.sh --summary
pm2 status && pm2 logs --lines 20
curl -f https://yourdomain.com/api/admin/health
```

---

**Last Updated**: $(date '+%Y-%m-%d')  
**Version**: 1.0  
**Review Date**: [Next Review Date]