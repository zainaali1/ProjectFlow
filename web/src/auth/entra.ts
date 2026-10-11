import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser';
import type { AuthApi } from './AuthContext';

/**
 * Microsoft Entra ID sign-in for the browser, using MSAL.js with the
 * authorization-code flow + PKCE (the recommended flow for SPAs; no secrets
 * live in the browser). Tokens are cached in sessionStorage, so closing the
 * tab signs the user out of the app.
 */
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
const clientId = import.meta.env.VITE_SPA_CLIENT_ID;
const apiScope = import.meta.env.VITE_API_SCOPE;

const msalConfig: Configuration = {
  auth: {
    clientId: clientId ?? '',
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
};

export class EntraConfigError extends Error {}

/**
 * Starts MSAL, finishes a sign-in redirect if we are returning from one, and
 * sends the user to the Microsoft sign-in page if nobody is signed in.
 * Resolves to null while a redirect is in progress.
 */
export async function startEntraAuth(): Promise<AuthApi | null> {
  if (!tenantId || !clientId || !apiScope) {
    throw new EntraConfigError(
      'Sign-in is not configured. Set VITE_AZURE_TENANT_ID, VITE_SPA_CLIENT_ID and VITE_API_SCOPE (see web/.env.example), or use VITE_AUTH_MODE=dev locally.',
    );
  }

  const msal = new PublicClientApplication(msalConfig);
  await msal.initialize();

  const result = await msal.handleRedirectPromise();
  let account: AccountInfo | null = result?.account ?? msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;

  if (!account) {
    await msal.loginRedirect({ scopes: [apiScope] });
    return null;
  }
  msal.setActiveAccount(account);

  return {
    user: { name: account.name ?? account.username, username: account.username },
    async getToken() {
      account = msal.getActiveAccount() ?? account;
      try {
        const res = await msal.acquireTokenSilent({ scopes: [apiScope], account: account! });
        return res.accessToken;
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
          // e.g. MFA or consent needed - go back through the sign-in page
          await msal.acquireTokenRedirect({ scopes: [apiScope], account: account! });
        }
        throw err;
      }
    },
    signOut() {
      void msal.logoutRedirect({ account });
    },
  };
}
