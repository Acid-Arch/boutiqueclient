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
  appUrl: PUBLIC_APP_URL || 'http://silentsignal.io'
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
            model: result.user.model,
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

const baseUrl = PUBLIC_APP_URL || (dev ? 'http://localhost:5173' : undefined);

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
        secure: !dev && (baseUrl ? baseUrl.startsWith('https') : true),
      }
    }
  },
  useSecureCookies: !dev && (baseUrl ? baseUrl.startsWith('https') : true),
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
        console.log('🎫 JWT creation for user:', user.email, 'provider:', account.provider);
        
        // For Google OAuth, we need to fetch user data from database
        if (account.provider === 'google') {
          try {
            const dbUser = await AuthService.getUserByEmail(user.email);
            if (dbUser) {
              console.log('📊 Google OAuth: Found user in database with model:', dbUser.model);
              token.role = dbUser.role || 'VIEWER';
              token.model = dbUser.model || null;
              token.isNewUser = false;
              token.accountLinked = true;
            } else {
              console.log('⚠️ Google OAuth: User not found in database:', user.email);
              token.role = 'VIEWER';
              token.model = null;
              token.isNewUser = true;
              token.accountLinked = false;
            }
          } catch (error) {
            console.error('❌ Error fetching user data during OAuth:', error);
            token.role = 'VIEWER';
            token.model = null;
            token.isNewUser = true;
            token.accountLinked = false;
          }
        } else {
          // For credentials login, use the user object directly
          token.role = (user as any).role || 'VIEWER';
          token.model = (user as any).model || null;
          token.isNewUser = (user as any).isNewUser || false;
          token.accountLinked = (user as any).accountLinked || false;
        }
        
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub || '';
        session.user.role = token.role as string;
        session.user.model = token.model as string;
        session.user.provider = token.provider as string;
        session.user.isNewUser = token.isNewUser as boolean;
        session.user.accountLinked = token.accountLinked as boolean;
      }
      return session;
    }
  }
};

console.log('🔐 AUTH CONFIGURATION LOADED');
console.log(`Providers: ${providers.map(p => (p as any).id || (p as any).name).join(', ')}`);
console.log(`Base URL: ${baseUrl || 'auto-detected'}`);
console.log(`Secure cookies: ${!dev && (baseUrl ? baseUrl.startsWith('https') : true)}`);
console.log(`Debug mode: ${dev}`);

console.log('✅ Multiple auth methods available');

export const { handle: authHandle, signIn, signOut } = SvelteKitAuth(authConfig);