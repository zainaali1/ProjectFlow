import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet, type JWK } from 'jose';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import { MemoryRepository } from '../src/data/memoryRepository.js';

const baseConfig: AppConfig = {
  nodeEnv: 'test',
  port: 0,
  authMode: 'dev',
  entra: {
    tenantId: '11111111-1111-1111-1111-111111111111',
    apiClientId: '22222222-2222-2222-2222-222222222222',
    audience: ['22222222-2222-2222-2222-222222222222', 'api://22222222-2222-2222-2222-222222222222'],
    requiredScope: 'access_as_user',
    managerRole: 'ProjectFlow.Manager',
    enforceRoles: false,
  },
  dataProvider: 'memory',
  sql: { server: '', database: '', auth: 'aad-default' },
  corsOrigins: [],
};

describe('ProjectFlow API (dev auth, in-memory data)', () => {
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    app = createApp(new MemoryRepository(), baseConfig);
  });

  it('reports health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('lists seeded projects with task counts', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(6);
    expect(res.body[0]).toHaveProperty('taskCount');
  });

  it('creates, updates and deletes a project', async () => {
    const created = await request(app).post('/api/projects').send({ name: 'New Office Move', status: 'Planned', startDate: '2026-11-01', endDate: '2026-12-01' });
    expect(created.status).toBe(201);
    const id = created.body.projectId;
    const updated = await request(app).put(`/api/projects/${id}`).send({ ...created.body, status: 'Active' });
    expect(updated.body.status).toBe('Active');
    expect((await request(app).delete(`/api/projects/${id}`)).status).toBe(204);
    expect((await request(app).get(`/api/projects/${id}`)).status).toBe(404);
  });

  it('rejects invalid input with field errors', async () => {
    const res = await request(app).post('/api/projects').send({ name: '', startDate: '2026-12-01', endDate: '2026-11-01' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { field: string }) => d.field)).toContain('name');
  });

  it('rejects end date before start date', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'X', startDate: '2026-12-01', endDate: '2026-11-01' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('endDate');
  });

  it('filters tasks by project', async () => {
    const res = await request(app).get('/api/tasks?projectId=1');
    expect(res.status).toBe(200);
    expect(res.body.every((t: { projectId: number }) => t.projectId === 1)).toBe(true);
  });

  it('prevents double-booking a worker', async () => {
    const entry = { workerId: 1, projectId: 1, taskId: null, startTime: '2030-01-07T09:00', endTime: '2030-01-07T12:00' };
    expect((await request(app).post('/api/schedule').send(entry)).status).toBe(201);
    const clash = await request(app).post('/api/schedule').send({ ...entry, startTime: '2030-01-07T11:00', endTime: '2030-01-07T13:00' });
    expect(clash.status).toBe(409);
    expect(clash.body.details.conflicts.length).toBe(1);
    // back-to-back is fine
    const next = await request(app).post('/api/schedule').send({ ...entry, startTime: '2030-01-07T12:00', endTime: '2030-01-07T13:00' });
    expect(next.status).toBe(201);
  });

  it('requires the task to belong to the project', async () => {
    const tasks = (await request(app).get('/api/tasks?projectId=2')).body;
    const res = await request(app)
      .post('/api/schedule')
      .send({ workerId: 1, projectId: 1, taskId: tasks[0].taskId, startTime: '2030-02-04T09:00', endTime: '2030-02-04T10:00' });
    expect(res.status).toBe(400);
  });

  it('filters the schedule by date range', async () => {
    const all = (await request(app).get('/api/schedule')).body as { startTime: string }[];
    const pivot = all[Math.floor(all.length / 2)]!.startTime.slice(0, 10);
    const res = await request(app).get(`/api/schedule?from=${pivot}&to=${pivot}T23:59`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((s: { startTime: string }) => s.startTime.startsWith(pivot))).toBe(true);
  });

  it('deleting a project removes its tasks and schedule', async () => {
    await request(app).delete('/api/projects/1');
    expect((await request(app).get('/api/tasks?projectId=1')).body).toEqual([]);
    expect((await request(app).get('/api/schedule?projectId=1')).body).toEqual([]);
  });

  it('returns a dashboard summary', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.projects.total).toBe(6);
    expect(res.body.workers.total).toBe(12);
  });
});

describe('Entra ID token validation', () => {
  let privateKey: CryptoKey;
  let jwk: JWK;
  const cfg: AppConfig = { ...baseConfig, authMode: 'entra' };
  const issuer = `https://login.microsoftonline.com/${cfg.entra.tenantId}/v2.0`;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey as CryptoKey;
    jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256', use: 'sig' };
  });

  const makeApp = (overrides: Partial<AppConfig['entra']> = {}) =>
    createApp(new MemoryRepository(), { ...cfg, entra: { ...cfg.entra, ...overrides } }, { keySet: createLocalJWKSet({ keys: [jwk] }) });

  const token = (claims: Record<string, unknown> = {}, aud = cfg.entra.apiClientId) =>
    new SignJWT({ scp: 'access_as_user', name: 'Test User', oid: 'abc', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(issuer)
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

  it('rejects requests without a token', async () => {
    expect((await request(makeApp()).get('/api/projects')).status).toBe(401);
  });

  it('accepts a valid token', async () => {
    const res = await request(makeApp()).get('/api/me').set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test User');
  });

  it('rejects a token for another API', async () => {
    const res = await request(makeApp()).get('/api/projects').set('Authorization', `Bearer ${await token({}, 'someone-else')}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token without the scope', async () => {
    const res = await request(makeApp()).get('/api/projects').set('Authorization', `Bearer ${await token({ scp: 'User.Read' })}`);
    expect(res.status).toBe(403);
  });

  it('enforces the manager role for writes when enabled', async () => {
    const app = makeApp({ enforceRoles: true });
    const reader = await token();
    expect((await request(app).get('/api/projects').set('Authorization', `Bearer ${reader}`)).status).toBe(200);
    expect((await request(app).post('/api/projects').set('Authorization', `Bearer ${reader}`).send({ name: 'X' })).status).toBe(403);
    const manager = await token({ roles: ['ProjectFlow.Manager'] });
    expect((await request(app).post('/api/projects').set('Authorization', `Bearer ${manager}`).send({ name: 'X' })).status).toBe(201);
  });

  it('health check stays public', async () => {
    expect((await request(makeApp()).get('/api/health')).status).toBe(200);
  });
});
