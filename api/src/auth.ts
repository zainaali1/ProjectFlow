import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { AppConfig } from './config.js';

export interface AuthUser {
  /** Entra object id - stable unique id of the signed-in user */
  oid: string;
  name: string;
  username: string;
  roles: string[];
  scopes: string[];
  isManager: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const DEV_USER: AuthUser = {
  oid: '00000000-0000-0000-0000-000000000000',
  name: 'Local Developer',
  username: 'dev@localhost',
  roles: ['ProjectFlow.Manager'],
  scopes: ['access_as_user'],
  isManager: true,
};

/**
 * Protects the API with Microsoft Entra ID (Azure AD) access tokens.
 *
 * Every request must carry `Authorization: Bearer <token>`. The token is
 * checked for: a valid signature (Microsoft's published signing keys), the
 * right issuer (your tenant), the right audience (this API's app
 * registration), expiry, and the `access_as_user` scope.
 *
 * AUTH_MODE=dev skips this for local development only (blocked in production).
 */
export function createAuthMiddleware(config: AppConfig, keySet?: JWTVerifyGetKey): RequestHandler {
  if (config.authMode === 'dev') {
    return (req, _res, next) => {
      req.user = DEV_USER;
      next();
    };
  }

  const { tenantId, audience, requiredScope, managerRole } = config.entra;
  const jwks: JWTVerifyGetKey = keySet ?? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));
  const issuers = [`https://login.microsoftonline.com/${tenantId}/v2.0`, `https://sts.windows.net/${tenantId}/`];

  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Sign in required' });
      return;
    }

    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: issuers,
        audience,
        algorithms: ['RS256'],
        clockTolerance: 60,
      });

      const scopes = typeof payload.scp === 'string' ? payload.scp.split(' ') : [];
      const roles = Array.isArray(payload.roles) ? (payload.roles as string[]) : [];

      // Delegated (user) tokens must include our scope. App-only tokens have no scp and must carry an app role.
      if (!scopes.includes(requiredScope) && roles.length === 0) {
        res.status(403).json({ error: `Token is missing the ${requiredScope} scope` });
        return;
      }

      req.user = {
        oid: String(payload.oid ?? payload.sub ?? ''),
        name: String(payload.name ?? payload.preferred_username ?? 'Unknown user'),
        username: String(payload.preferred_username ?? payload.upn ?? ''),
        roles,
        scopes,
        isManager: roles.includes(managerRole),
      };
      next();
    } catch (err) {
      const expired = err instanceof joseErrors.JWTExpired;
      res.setHeader('WWW-Authenticate', `Bearer error="invalid_token"`);
      res.status(401).json({ error: expired ? 'Token expired' : 'Invalid token' });
    }
  };
}

/**
 * Authorization for changes (POST/PUT/DELETE). With ENFORCE_ROLES=true only
 * users assigned the "ProjectFlow.Manager" app role in Entra ID can modify
 * data; everyone signed in can still read.
 */
export function requireManager(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    if (!config.entra.enforceRoles || req.user?.isManager) return next();
    res.status(403).json({ error: `You need the ${config.entra.managerRole} role to make changes` });
  };
}
