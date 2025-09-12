module.exports = {
  apps: [{
    name: 'boutique-client-portal',
    script: '.svelte-kit/output/server/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 5173,
      DATABASE_URL: 'postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent',
      NEXTAUTH_URL: 'https://silentsignal.io',
      AUTH_URL: 'https://silentsignal.io',
      PUBLIC_APP_URL: 'https://silentsignal.io',
      AUTH_SECRET: 'development-secret-32-chars-minimum'
    }
  }]
}
