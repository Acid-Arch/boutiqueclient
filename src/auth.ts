import { SvelteKitAuth } from '@auth/sveltekit';
import type { Provider } from '@auth/core/providers';
import { dev } from '$app/environment';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$env/static/private';

// Temporary authentication setup for IP-only deployment
// This bypasses OAuth for testing on Hetzner server
// To be replaced with full OAuth when domain is configured

export const { handle: authHandle, signIn, signOut } = SvelteKitAuth({
  providers: [
    // Credentials provider for temporary access during IP-only deployment
    {
      id: 'test-admin',
      name: 'Test Admin Access',
      type: 'credentials',
      credentials: {
        username: { 
          label: 'Username', 
          type: 'text', 
          placeholder: 'Enter admin username' 
        },
        password: { 
          label: 'Password', 
          type: 'password' 
        }
      },
      async authorize(credentials) {
        // TEMPORARY: Simple hardcoded credentials for testing
        // In production with domain, this should be removed
        if (
          credentials?.username === 'admin' && 
          credentials?.password === 'boutique2024!'
        ) {
          return {
            id: 'test-admin-001',
            email: 'admin@boutique.local',
            name: 'Test Admin',
            role: 'ADMIN',
            accountLinked: true,
            isNewUser: false
          };
        }
        
        // Check for test client user
        if (
          credentials?.username === 'client' && 
          credentials?.password === 'client2024!'
        ) {
          return {
            id: 'test-client-001',
            email: 'client@boutique.local',
            name: 'Test Client',
            role: 'CLIENT',
            accountLinked: true,
            isNewUser: false
          };
        }
        
        return null;
      }
    }
  ] as Provider[],
  
  // Session configuration
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours for testing
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
        secure: false, // HTTP-only for IP deployment
        domain: undefined // No domain for IP-based access
      }
    },
    callbackUrl: {
      name: 'boutique-callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false
      }
    },
    csrfToken: {
      name: 'boutique-csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false
      }
    }
  },
  
  // No secure cookies for HTTP deployment
  useSecureCookies: false,
  
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
  
  // Simplified callbacks for IP-only deployment
  callbacks: {
    async signIn({ user, account }) {
      // Allow all credential-based sign-ins for testing
      if (account?.provider === 'test-admin') {
        console.log(`IP-only test login: ${user.email}`);
        return true;
      }
      return false;
    },
    
    async jwt({ token, user, account }) {
      // Handle initial sign in for test users
      if (account && user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.isNewUser = user.isNewUser || false;
        token.accountLinked = user.accountLinked || true;
        
        console.log(`JWT created for test user: ${user.email}`);
      }
      
      return token;
    },
    
    async session({ session, token }) {
      // Add custom user data to session
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.isNewUser = token.isNewUser as boolean;
        session.user.accountLinked = token.accountLinked as boolean;
      }
      
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      // Handle redirects for IP-based deployment
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      
      const returnUrl = new URL(url).searchParams.get('redirectTo') || 
                       new URL(url).searchParams.get('callbackUrl');
      
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
      console.log(`IP-only deployment sign in: ${user.email} (provider: ${account?.provider})`);
    }
  },
  
  // Enable debug for IP testing
  debug: true,
  
  // Trust host for IP-based deployment
  trustHost: true,
  
  // Secret for JWT signing
  secret: (() => {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    
    if (!secret) {
      console.warn('⚠️  WARNING: Using fallback secret for IP-only deployment testing');
      return 'ip-only-deployment-test-secret-not-for-production-use-2024-boutique-testing';
    }
    
    return secret;
  })()
});

// Export test credentials for documentation
export const TEST_CREDENTIALS = {
  admin: {
    username: 'admin',
    password: 'boutique2024!',
    role: 'ADMIN'
  },
  client: {
    username: 'client',
    password: 'client2024!',
    role: 'CLIENT'
  }
};

// Warning message for production
console.log(`
⚠️  IP-ONLY DEPLOYMENT AUTH ACTIVE ⚠️
Test credentials:
- Admin: admin / boutique2024!
- Client: client / client2024!

This is TEMPORARY for IP-only testing.
Replace with full OAuth when domain is configured.
`);

// Export custom types for TypeScript (same as main auth.ts)
declare module '@auth/core/types' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: string;
      isNewUser: boolean;
      accountLinked: boolean;
    };
  }
  
  interface User {
    id: string;
    email: string;
    name: string;
    image?: string;
    role: string;
    isNewUser?: boolean;
    accountLinked?: boolean;
  }
  
  interface JWT {
    userId: string;
    email: string;
    name: string;
    role: string;
    isNewUser: boolean;
    accountLinked: boolean;
  }
}