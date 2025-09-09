import { r as redirect } from './index-Djsj11qr.js';
import { b as base, p as private_env, s as setCookieExports } from './set-cookie-CLsaEPEn.js';
import { isAuthAction, Auth, skipCSRFCheck, setEnvDefaults as setEnvDefaults$1, createActionURL, raw } from '@auth/core';
import { d as dev } from './index-Dn7PghUK.js';
import '@auth/core/errors';

function setEnvDefaults(envObject, config) {
  config.trustHost ??= dev;
  config.basePath = `${base}/auth`;
  config.skipCSRFCheck = skipCSRFCheck;
  setEnvDefaults$1(envObject, config);
}
async function signIn(provider, options = {}, authorizationParams, config, event) {
  const { request, url: { protocol } } = event;
  const headers = new Headers(request.headers);
  const { redirect: shouldRedirect = true, redirectTo, ...rest } = options instanceof FormData ? Object.fromEntries(options) : options;
  const callbackUrl = redirectTo?.toString() ?? headers.get("Referer") ?? "/";
  const signInURL = createActionURL("signin", protocol, headers, private_env, config);
  if (!provider) {
    signInURL.searchParams.append("callbackUrl", callbackUrl);
    if (shouldRedirect)
      redirect(302, signInURL.toString());
    return signInURL.toString();
  }
  let url = `${signInURL}/${provider}?${new URLSearchParams(authorizationParams)}`;
  let foundProvider = {};
  for (const providerConfig of config.providers) {
    const { options: options2, ...defaults } = typeof providerConfig === "function" ? providerConfig() : providerConfig;
    const id = options2?.id ?? defaults.id;
    if (id === provider) {
      foundProvider = {
        id,
        type: options2?.type ?? defaults.type
      };
      break;
    }
  }
  if (!foundProvider.id) {
    const url2 = `${signInURL}?${new URLSearchParams({ callbackUrl })}`;
    if (shouldRedirect)
      redirect(302, url2);
    return url2;
  }
  if (foundProvider.type === "credentials") {
    url = url.replace("signin", "callback");
  }
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  const body = new URLSearchParams({ ...rest, callbackUrl });
  const req = new Request(url, { method: "POST", headers, body });
  const res = await Auth(req, { ...config, raw });
  for (const c of res?.cookies ?? []) {
    event.cookies.set(c.name, c.value, { path: "/", ...c.options });
  }
  if (shouldRedirect) {
    return redirect(302, res.redirect);
  }
  return res.redirect;
}
async function signOut(options, config, event) {
  const { request, url: { protocol } } = event;
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  const url = createActionURL("signout", protocol, headers, private_env, config);
  const callbackUrl = options?.redirectTo ?? headers.get("Referer") ?? "/";
  const body = new URLSearchParams({ callbackUrl });
  const req = new Request(url, { method: "POST", headers, body });
  const res = await Auth(req, { ...config, raw });
  for (const c of res?.cookies ?? [])
    event.cookies.set(c.name, c.value, { path: "/", ...c.options });
  if (options?.redirect ?? true)
    return redirect(302, res.redirect);
  return res;
}
async function auth(event, config) {
  setEnvDefaults(private_env, config);
  config.trustHost ??= true;
  const { request: req, url: { protocol } } = event;
  const sessionUrl = createActionURL("session", protocol, req.headers, private_env, config);
  const request = new Request(sessionUrl, {
    headers: { cookie: req.headers.get("cookie") ?? "" }
  });
  const response = await Auth(request, config);
  const authCookies = setCookieExports.parse(response.headers.getSetCookie());
  for (const cookie of authCookies) {
    const { name, value, ...options } = cookie;
    event.cookies.set(name, value, { path: "/", ...options });
  }
  const { status = 200 } = response;
  const data = await response.json();
  if (!data || !Object.keys(data).length)
    return null;
  if (status === 200)
    return data;
  throw new Error(data.message);
}
const authorizationParamsPrefix = "authorizationParams-";
function SvelteKitAuth(config) {
  return {
    signIn: async (event) => {
      const { request } = event;
      const _config = typeof config === "object" ? config : await config(event);
      setEnvDefaults(private_env, _config);
      const formData = await request.formData();
      const { providerId: provider, ...options } = Object.fromEntries(formData);
      const authorizationParams = {};
      const _options = {};
      for (const key in options) {
        if (key.startsWith(authorizationParamsPrefix)) {
          authorizationParams[key.slice(authorizationParamsPrefix.length)] = options[key];
        } else {
          _options[key] = options[key];
        }
      }
      await signIn(provider, _options, authorizationParams, _config, event);
    },
    signOut: async (event) => {
      const _config = typeof config === "object" ? config : await config(event);
      setEnvDefaults(private_env, _config);
      const options = Object.fromEntries(await event.request.formData());
      await signOut(options, _config, event);
    },
    async handle({ event, resolve }) {
      const _config = typeof config === "object" ? config : await config(event);
      setEnvDefaults(private_env, _config);
      const { url, request } = event;
      event.locals.auth ??= () => auth(event, _config);
      event.locals.getSession ??= event.locals.auth;
      const action = url.pathname.slice(
        // @ts-expect-error - basePath is defined in setEnvDefaults
        _config.basePath.length + 1
      ).split("/")[0];
      if (isAuthAction(action) && url.pathname.startsWith(_config.basePath + "/")) {
        return Auth(request, _config);
      }
      return resolve(event);
    }
  };
}
const { handle: authHandle } = SvelteKitAuth({
  providers: [
    // Credentials provider for temporary access during IP-only deployment
    {
      id: "test-admin",
      name: "Test Admin Access",
      type: "credentials",
      credentials: {
        username: {
          label: "Username",
          type: "text",
          placeholder: "Enter admin username"
        },
        password: {
          label: "Password",
          type: "password"
        }
      },
      async authorize(credentials) {
        if (credentials?.username === "admin" && credentials?.password === "boutique2024!") {
          return {
            id: "test-admin-001",
            email: "admin@boutique.local",
            name: "Test Admin",
            role: "ADMIN",
            accountLinked: true,
            isNewUser: false
          };
        }
        if (credentials?.username === "client" && credentials?.password === "client2024!") {
          return {
            id: "test-client-001",
            email: "client@boutique.local",
            name: "Test Client",
            role: "CLIENT",
            accountLinked: true,
            isNewUser: false
          };
        }
        return null;
      }
    }
  ],
  // Session configuration
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
    // 24 hours for testing
    updateAge: 6 * 60 * 60
    // Update every 6 hours
  },
  // Cookies configuration
  cookies: {
    sessionToken: {
      name: "boutique-session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        // HTTP-only for IP deployment
        domain: void 0
        // No domain for IP-based access
      }
    },
    callbackUrl: {
      name: "boutique-callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false
      }
    },
    csrfToken: {
      name: "boutique-csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false
      }
    }
  },
  // No secure cookies for HTTP deployment
  useSecureCookies: false,
  // JWT configuration
  jwt: {
    maxAge: 24 * 60 * 60
    // 24 hours
  },
  // Page configuration
  pages: {
    signIn: "/login",
    error: "/login",
    signOut: "/login"
  },
  // Simplified callbacks for IP-only deployment
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "test-admin") {
        console.log(`IP-only test login: ${user.email}`);
        return true;
      }
      return false;
    },
    async jwt({ token, user, account }) {
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
      if (token.userId) {
        session.user.id = token.userId;
        session.user.role = token.role;
        session.user.isNewUser = token.isNewUser;
        session.user.accountLinked = token.accountLinked;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      const returnUrl = new URL(url).searchParams.get("redirectTo") || new URL(url).searchParams.get("callbackUrl");
      if (returnUrl && returnUrl.startsWith("/")) {
        return `${baseUrl}${returnUrl}`;
      }
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
      console.warn("⚠️  WARNING: Using fallback secret for IP-only deployment testing");
      return "ip-only-deployment-test-secret-not-for-production-use-2024-boutique-testing";
    }
    return secret;
  })()
});
console.log(`
⚠️  IP-ONLY DEPLOYMENT AUTH ACTIVE ⚠️
Test credentials:
- Admin: admin / boutique2024!
- Client: client / client2024!

This is TEMPORARY for IP-only testing.
Replace with full OAuth when domain is configured.
`);

export { authHandle as a };
//# sourceMappingURL=auth-D00jg8WF.js.map
