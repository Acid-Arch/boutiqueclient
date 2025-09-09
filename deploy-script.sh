#!/bin/bash
cd /opt/boutique-client/app
cp -r ../app-backup-simple/node_modules .
chown -R boutique-client:users node_modules
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
export DATABASE_URL="postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=require"
export AUTH_SECRET="trJyKpteLvjXQqmkIxksLJ0/T4Avz07eskEpRCO40jY="
export ORIGIN="http://5.78.147.68:3000"
export PORT=3000
pm2 start build/index.js --name boutique-portal
pm2 save
