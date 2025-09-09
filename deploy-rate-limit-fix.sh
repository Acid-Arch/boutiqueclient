#!/bin/bash

# Deploy rate limit fix to server
echo "🚀 Deploying rate limit fix..."

# Deploy on server
ssh admin@5.78.147.68 << 'EOF'
# Stop current application
pm2 stop boutique-portal

# Backup current build
sudo cp -r /opt/boutique-client/app/build /opt/boutique-client/app/build-backup-$(date +%Y%m%d-%H%M%S)

# Extract new build
cd /opt/boutique-client/app
tar -xzf /tmp/boutique-deployment-fix.tar.gz

# Replace build directory with fixed version
sudo rm -rf build
sudo mv deployment-package/build .
sudo mv deployment-package/src/lib/server src/lib/server
sudo chown -R boutique-client:users build src

# Restart application
pm2 start boutique-portal

echo "✅ Rate limit fix deployed successfully!"
pm2 status
EOF

echo "🎉 Deployment complete!"