#!/bin/bash

echo "🚀 Force clean deployment..."

# Create deployment package
tar -czf boutique-clean.tar.gz build/

# Transfer to server
scp boutique-clean.tar.gz admin@5.78.147.68:/tmp/

# Deploy with clean slate
ssh admin@5.78.147.68 << 'EOF'
# Stop all processes
pm2 delete boutique-portal || true

# Completely remove old build
cd /opt/boutique-client/app
rm -rf build || sudo rm -rf build

# Extract fresh build
tar -xzf /tmp/boutique-clean.tar.gz

# Fix permissions if needed
chown -R boutique-client:users build 2>/dev/null || sudo chown -R boutique-client:users build

# Start fresh process
pm2 start build/index.js --name boutique-portal --env production

echo "✅ Clean deployment complete!"
pm2 status
EOF

echo "🎉 Force clean deployment finished!"