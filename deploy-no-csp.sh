#!/bin/bash

echo "🔧 Deploying build without CSP for testing..."

ssh admin@5.78.147.68 << 'EOF'
# Stop application
pm2 stop boutique-portal

# Navigate to app directory
cd /opt/boutique-client/app

# Backup current build
mv build build-backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# Extract new build (use sudo if needed for permissions)
if [ -w /opt/boutique-client/app ]; then
    tar -xzf /tmp/boutique-no-csp.tar.gz
else
    echo "Need permissions, using sudo..."
    sudo tar -xzf /tmp/boutique-no-csp.tar.gz
    sudo chown -R boutique-client:users build
fi

# Restart application
pm2 start boutique-portal

echo "✅ No-CSP deployment complete!"
pm2 status
EOF

echo "🎉 Deployment finished!"