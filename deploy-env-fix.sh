#!/bin/bash

echo "🔧 Fixing environment configuration for HTTP-only deployment..."

ssh admin@5.78.147.68 << 'EOF'
# Stop the application
pm2 stop boutique-portal

# Navigate to app directory
cd /opt/boutique-client/app

# Create corrected .env file
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=require"
AUTH_SECRET="trJyKpteLvjXQqmkIxksLJ0/T4Avz07eskEpRCO40jY="
NEXTAUTH_SECRET="F3Ujkvt22UzIWdCiEwQnKyC5UYIP3OY8rDPsnmLywFA="

# Force HTTP-only URLs (no HTTPS)
PUBLIC_APP_URL="http://5.78.147.68"
ORIGIN="http://5.78.147.68"
AUTH_URL="http://5.78.147.68"
NEXTAUTH_URL="http://5.78.147.68"

# Trust host for HTTP deployment
AUTH_TRUST_HOST=true
VITE_PUBLIC_APP_URL="http://5.78.147.68"

# Disable SSL/HTTPS features
PUBLIC_SECURE_COOKIES=false
SECURE_COOKIES=false

# Other required variables
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
GOOGLE_CLIENT_ID="disabled-for-ip-deployment"
GOOGLE_CLIENT_SECRET="disabled-for-ip-deployment"
PUBLIC_APP_NAME="Client Portal"
INSTANCE_ID="dddb6459-ec38-444c-bb59-2bd872a08d23"
WS_AUTH_TOKEN="4gFipN6MG5d8nQNU0B93QyLTsMrs6xMU"
ENVEOF

# Show the environment file
echo "📋 Environment file created:"
cat .env

# Restart the application
pm2 start boutique-portal

echo "✅ Environment fix deployed!"
pm2 status
EOF

echo "🎉 Environment configuration fix complete!"