import { createContext, useContext } from 'react';

export interface SignedInUser {
  name: string;
  username: string;
}

/** What the rest of the app needs from authentication, independent of how it is done. */
export interface AuthApi {
  user: SignedInUser;
  /** Returns an access token for the ProjectFlow API, or null in dev mode. */
  getToken: () => Promise<string | null>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthContext.Provider>');
  return ctx;
}
