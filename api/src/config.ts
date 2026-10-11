/**
 * All configuration comes from environment variables (App Service
 * "Application settings" in Azure, or api/.env locally - see .env.example).
 * Nothing secret is ever hard-coded.
 */

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export type AuthMode = 'entra' | 'dev';
export type DataProvider = 'mssql' | 'memory';
/** aad-default = Microsoft Entra auth via DefaultAzureCredential (az login locally, managed identity in Azure). */
export type DbAuth = 'aad-default' | 'sql';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  authMode: AuthMode;
  entra: { tenantId: string; apiClientId: string; audience: string[]; requiredScope: string; managerRole: string; enforceRoles: boolean };
  dataProvider: DataProvider;
  sql: {
    server: string;
    database: string;
    auth: DbAuth;
    managedIdentityClientId?: string;
    user?: string;
    password?: string;
  };
  corsOrigins: string[];
  serveWebFrom?: string;
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const authMode = (process.env.AUTH_MODE ?? 'entra') as AuthMode;
  const dataProvider = (process.env.DATA_PROVIDER ?? 'mssql') as DataProvider;

  if (!['entra', 'dev'].includes(authMode)) throw new Error(`AUTH_MODE must be "entra" or "dev"`);
  if (!['mssql', 'memory'].includes(dataProvider)) throw new Error(`DATA_PROVIDER must be "mssql" or "memory"`);

  // Security guard: the auth bypass can never be switched on in production.
  if (authMode === 'dev' && nodeEnv === 'production') {
    throw new Error('AUTH_MODE=dev is not allowed when NODE_ENV=production');
  }

  const tenantId = authMode === 'entra' ? env('AZURE_TENANT_ID') : process.env.AZURE_TENANT_ID ?? '';
  const apiClientId = authMode === 'entra' ? env('API_CLIENT_ID') : process.env.API_CLIENT_ID ?? '';

  const dbAuth = (process.env.SQL_AUTH ?? 'aad-default') as DbAuth;
  if (!['aad-default', 'sql'].includes(dbAuth)) throw new Error('SQL_AUTH must be "aad-default" or "sql"');

  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 3001),
    authMode,
    entra: {
      tenantId,
      apiClientId,
      // Entra issues v2 tokens with aud = client id; v1 tokens use the App ID URI.
      audience: [apiClientId, `api://${apiClientId}`].filter(Boolean),
      requiredScope: process.env.API_SCOPE ?? 'access_as_user',
      managerRole: process.env.MANAGER_ROLE ?? 'ProjectFlow.Manager',
      enforceRoles: bool('ENFORCE_ROLES', false),
    },
    dataProvider,
    sql:
      dataProvider === 'mssql'
        ? {
            server: env('SQL_SERVER'),
            database: env('SQL_DATABASE'),
            auth: dbAuth,
            managedIdentityClientId: process.env.SQL_MANAGED_IDENTITY_CLIENT_ID || undefined,
            user: dbAuth === 'sql' ? env('SQL_USER') : undefined,
            password: dbAuth === 'sql' ? env('SQL_PASSWORD') : undefined,
          }
        : { server: '', database: '', auth: dbAuth },
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    serveWebFrom: process.env.WEB_DIST_DIR || undefined,
  };
}
