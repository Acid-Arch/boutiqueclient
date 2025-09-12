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

console.log('🔧 Initializing unified auth with:', {
  hasGoogleClientId: !!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'disabled-for-ip-deployment',
  hasGoogleSecret: !!GOOGLE_CLIENT_SECRET && GOOGLE_CLIENT_SECRET !== 'disabled-for-ip-deployment',
  hasAuthSecret: !!AUTH_SECRET,
  appUrl: PUBLIC_APP_URL || 'https://silentsignal.io'
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

// Add credentials provider as fallback
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

const baseUrl = PUBLIC_APP_URL || 'https://silentsignal.io';

export const authConfig = {
  providers,
  session: {
    strategy: 'jwt' as const,
    maxAge: 24 * 60 * 60,
    updateAge: 6 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: 'boutique-session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: !dev && baseUrl.startsWith('https'),
      }
    }
  },
  useSecureCookies: !dev && baseUrl.startsWith('https'),
  jwt: {
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
    error: '/login',
    signOut: '/login'
  },
  secret: AUTH_SECRET,
  trustHost: true,
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('🔐 Sign in attempt:', {
        provider: account?.provider,
        userEmail: user.email,
        hasProfile: !!profile
      });
      return true;
    },
    async jwt({ token, user, account, profile, trigger }) {
      if (trigger === 'signIn' && user && account) {
        console.log('🎫 JWT creation for user:', user.email);
        token.role = (user as any).role || 'VIEWER';
        token.provider = account.provider;
        token.isNewUser = (user as any).isNewUser || false;
        token.accountLinked = (user as any).accountLinked || false;
        
        // Fetch user model from database
        try {
          const dbUser = await AuthService.getUserByEmail(user.email);
          if (dbUser) {
            token.model = dbUser.model;
            console.log(`🔑 Model assigned to ${user.email}: ${dbUser.model}`);
          }
        } catch (error) {
          console.log(`⚠️  Failed to fetch model for ${user.email}:`, (error as Error).message);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub || '';
        session.user.role = token.role as string;
        session.user.provider = token.provider as string;
        session.user.isNewUser = token.isNewUser as boolean;
        session.user.accountLinked = token.accountLinked as boolean;
        session.user.model = token.model as string;
      }
      return session;
    }
  }
};

console.log('🔐 AUTH CONFIGURATION LOADED');
console.log(`Providers: ${providers.map(p => (p as any).id || (p as any).name).join(', ')}`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Secure cookies: ${!dev && baseUrl.startsWith('https')}`);
console.log(`Debug mode: ${dev}`);

console.log('✅ Multiple auth methods available');

export const { handle: authHandle, signIn, signOut } = SvelteKitAuth(authConfig);