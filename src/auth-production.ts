import { SvelteKitAuth } from '@auth/sveltekit';
import GoogleProvider from '@auth/core/providers/google';
import CredentialsProvider from '@auth/core/providers/credentials';
import type { Provider } from '@auth/core/providers';
import { dev } from '$app/environment';
import { AuthService } from '$lib/server/auth-direct.js';
import { 
  GOOGLE_CLIENT_ID, 
  GOOGLE_CLIENT_SECRET, 
  AUTH_SECRET
} from '$env/static/private';
import { PUBLIC_APP_URL } from '$env/static/public';

// Production authentication setup with Google OAuth
// Supports both OAuth and credentials for fallback

console.log('🔧 Initializing production auth with:', {
  hasGoogleClientId: !!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'disabled-for-ip-deployment',
  hasGoogleSecret: !!GOOGLE_CLIENT_SECRET && GOOGLE_CLIENT_SECRET !== 'disabled-for-ip-deployment',
  hasAuthSecret: !!AUTH_SECRET,
  appUrl: PUBLIC_APP_URL || 'http://5.78.147.68:5173'
});

const providers: Provider[] = [];

// Add Google OAuth if credentials are configured
if (GOOGLE_CLIENT_ID && 
    GOOGLE_CLIENT_SECRET && 
    GOOGLE_CLIENT_ID !== 'disabled-for-ip-deployment' && 
    GOOGLE_CLIENT_SECRET !== 'disabled-for-ip-deployment') {
  
  console.log('✅ Adding Google OAuth provider');
  providers.push(
    GoogleProvider({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "select_account",
          scope: "openid email profile"
        }
      }
    })
  );
} else {
  console.log('⚠️ Google OAuth disabled - missing or disabled credentials');
}

// Add credentials provider as fallback for development/testing
providers.push(
  CredentialsProvider({
    id: 'credentials',
    name: 'Email and Password',
    credentials: {
      email: { 
        label: 'Email', 
        type: 'email', 
        placeholder: 'Enter your email' 
      },
      password: { 
        label: 'Password', 
        type: 'password' 
      }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        console.log('❌ Missing email or password in credentials');
        return null;
      }

      try {
        // Use AuthService to authenticate against the database
        const result = await AuthService.authenticateUser(
          credentials.email as string, 
          credentials.password as string
        );

        if (result.success && result.user) {
          console.log('✅ Database authentication successful for:', credentials.email);
          return {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            isNewUser: false,
            accountLinked: true
          };
        } else {
          console.log('❌ Database authentication failed for:', credentials.email, 'Error:', result.error);
          return null;
        }
      } catch (error) {
        console.error('❌ Credentials authorization error:', error);
        return null;
      }
    }
  })
);

const baseUrl = PUBLIC_APP_URL || 'http://5.78.147.68:5173';

export const { handle: authHandle, signIn, signOut } = SvelteKitAuth({
  providers,
  
  // Session configuration
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 6 * 60 * 60, // Update every 6 hours
  },
  
  // Cookies configuration
  cookies: {
    sessionToken: {
      name: 'boutique-session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: !dev && baseUrl.startsWith('https'),
        domain: undefined // Let browser determine
      }
    }
  },
  
  // Use secure cookies only for HTTPS
  useSecureCookies: !dev && baseUrl.startsWith('https'),
  
  // JWT configuration
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  
  // Page configuration
  pages: {
    signIn: '/login',
    error: '/login',
    signOut: '/login'
  },
  
  // Callbacks
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('🔐 Sign in attempt:', {
        provider: account?.provider,
        userEmail: user.email,
        hasProfile: !!profile
      });

      // Allow all OAuth sign-ins from Google
      if (account?.provider === 'google') {
        console.log('✅ Google OAuth sign-in allowed');
        return true;
      }

      // Allow credentials sign-ins
      if (account?.provider === 'credentials') {
        console.log('✅ Credentials sign-in allowed');
        return true;
      }

      console.log('❌ Sign-in denied - unsupported provider');
      return false;
    },
    
    async jwt({ token, user, account }) {
      // Handle initial sign in
      if (account && user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.provider = account.provider;
        
        // Set role from user data or default for OAuth
        if (account.provider === 'google') {
          // For Google OAuth, determine role based on email domain or default to CLIENT
          token.role = user.email?.endsWith('@yourdomain.com') ? 'ADMIN' : 'CLIENT';
        } else {
          token.role = (user as any).role || 'CLIENT';
        }
        
        token.isNewUser = (user as any).isNewUser || false;
        token.accountLinked = (user as any).accountLinked || true;
        
        console.log('🎟️ JWT created for:', user.email, 'provider:', account.provider);
      }
      
      return token;
    },
    
    async session({ session, token }) {
      // Add custom user data to session
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.provider = token.provider as string;
        session.user.isNewUser = token.isNewUser as boolean;
        session.user.accountLinked = token.accountLinked as boolean;
      }
      
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      console.log('🔄 Auth redirect:', { url, baseUrl });
      
      // Handle relative URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      
      // Handle callback URLs
      const urlObj = new URL(url);
      const returnUrl = urlObj.searchParams.get('redirectTo') || 
                       urlObj.searchParams.get('callbackUrl');
      
      if (returnUrl && returnUrl.startsWith('/')) {
        return `${baseUrl}${returnUrl}`;
      }
      
      // Default redirect to client portal
      return `${baseUrl}/client-portal`;
    }
  },
  
  // Events for logging
  events: {
    async signIn({ user, account }) {
      console.log(`✅ Successful sign-in: ${user.email} via ${account?.provider}`);
    },
    async signOut({ token }) {
      console.log(`👋 Sign-out: ${token?.email || 'unknown user'}`);
    }
  },
  
  // Enable debug in development
  debug: dev,
  
  // Trust host for both IP and domain deployment
  trustHost: true,
  
  // Secret for JWT signing
  secret: AUTH_SECRET || 'fallback-development-secret-change-in-production'
});

// Export test credentials for documentation
export const TEST_CREDENTIALS = {
  admin: {
    email: 'admin@boutique.local',
    password: 'boutique2024!',
    role: 'ADMIN'
  },
  client: {
    email: 'client@boutique.local',
    password: 'client2024!',
    role: 'CLIENT'
  }
};

// Configuration summary
console.log(`
🔐 AUTH CONFIGURATION LOADED
Providers: ${providers.map(p => p.id || p.name).join(', ')}
Base URL: ${baseUrl}
Secure cookies: ${!dev && baseUrl.startsWith('https')}
Debug mode: ${dev}

${providers.length > 1 ? 
  '✅ Multiple auth methods available' : 
  '⚠️ Limited auth methods - configure Google OAuth for full functionality'
}
`);

// Export custom types for TypeScript
declare module '@auth/core/types' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: string;
      provider: string;
      isNewUser: boolean;
      accountLinked: boolean;
    };
  }
  
  interface User {
    id: string;
    email: string;
    name: string;
    image?: string;
    role?: string;
    isNewUser?: boolean;
    accountLinked?: boolean;
  }
  
  interface JWT {
    userId: string;
    email: string;
    name: string;
    role: string;
    provider: string;
    isNewUser: boolean;
    accountLinked: boolean;
  }
}