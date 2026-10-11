import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { JWTVerifyGetKey } from 'jose';
import { createAuthMiddleware } from './auth.js';
import type { AppConfig } from './config.js';
import type { Repository } from './data/repository.js';
import { HttpError } from './errors.js';
import { createApiRouter } from './routes.js';

export function createApp(repo: Repository, config: AppConfig, options: { keySet?: JWTVerifyGetKey } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // App Service sits behind a load balancer

  // Security headers. The CSP lets the React app talk to Microsoft sign-in.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'https://login.microsoftonline.com'],
          frameSrc: ["'self'", 'https://login.microsoftonline.com'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  // Only needed when the UI runs on a different origin (local Vite dev server).
  app.use('/api', cors({ origin: config.corsOrigins, allowedHeaders: ['Authorization', 'Content-Type'], maxAge: 600 }));
  app.use(express.json({ limit: '100kb' }));

  // Unauthenticated liveness probe for App Service health checks.
  app.get('/api/health', async (_req, res) => {
    try {
      await repo.healthCheck();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'database unavailable' });
    }
  });

  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use('/api', createAuthMiddleware(config, options.keySet));
  app.use('/api', createApiRouter(repo, config));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // In Azure the API also serves the built React app (one Web App, one origin).
  if (config.serveWebFrom && existsSync(config.serveWebFrom)) {
    const dir = path.resolve(config.serveWebFrom);
    app.use(express.static(dir, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dir, 'index.html')); // client-side routing fallback
    });
  }

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Request body is not valid JSON' });
      return;
    }
    if (err?.number === 2627 || err?.number === 2601) {
      res.status(409).json({ error: 'That record already exists' });
      return;
    }
    // Never leak internals (SQL text, stack traces) to the caller.
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  };
  app.use(errorHandler);

  return app;
}
