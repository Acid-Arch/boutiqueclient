# Google OAuth Setup for Boutique Client Portal

## Step 1: Create Google OAuth Application

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API or People API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set Application Type: "Web application"
6. Set Authorized JavaScript origins:
   - `http://5.78.147.68:5173` (for development)
   - `http://5.78.147.68:3000` (for production)
7. Set Authorized redirect URIs:
   - `http://5.78.147.68:5173/auth/callback/google`
   - `http://5.78.147.68:3000/auth/callback/google`
8. Copy the Client ID and Client Secret

## Step 2: Update Environment Variables

Replace these values in `.env.production`:

```env
GOOGLE_CLIENT_ID="YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="YOUR_ACTUAL_CLIENT_SECRET"
```

## Step 3: Test Configuration

Run the application and test both:
1. Google OAuth login
2. Credentials login (fallback)

## Current Test Setup

For immediate testing, I've configured the system to work with:
- **Credentials login**: admin@boutique.local / boutique2024!
- **Google OAuth**: Will work once you add real credentials

## IP-based OAuth Limitations

Google OAuth with IP addresses has limitations:
- Some features may not work perfectly
- Consider setting up a domain name for full functionality
- For production, use HTTPS with a proper domain

## Backup Authentication

The system includes credentials-based auth as fallback:
- Email: admin@boutique.local
- Password: boutique2024!
- Role: ADMIN