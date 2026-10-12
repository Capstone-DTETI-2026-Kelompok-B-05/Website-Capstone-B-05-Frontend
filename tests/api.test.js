import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });

test('Login sends username/password without an Authorization header', async () => {
  let request;
  const api = createApi(undefined, undefined, async (url, options) => {
    request = { url, ...options };
    return response(200, { success: true, token: 'issued-token', user: { role: 'admin' } });
  });
  const result = await api('/auth/login', { method: 'POST', body: { username: 'admin', password: 'test1234' } });
  assert.ok(request.url.endsWith('/api/v1/auth/login'));
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization, undefined);
  assert.equal(JSON.parse(request.body).username, 'admin');
  assert.equal(result.token, 'issued-token');
});

test('Authenticated mutations send Bearer token and JSON body', async () => {
  const api = createApi('jwt-token', undefined, async (url, options) => {
    assert.ok(url.endsWith('/cameras/camera-id'));
    assert.equal(options.method, 'PATCH');
    assert.equal(options.headers.Authorization, 'Bearer jwt-token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { isActive: false });
    return response(200, { success: true });
  });
  await api('/cameras/camera-id', { method: 'PATCH', body: { isActive: false } });
});

test('Expired session triggers logout and surfaces backend message', async () => {
  let expired = false;
  const api = createApi('expired-token', () => { expired = true; }, async () => response(401, { success: false, message: 'Authentication token has expired' }));
  await assert.rejects(api('/accounts'), /has expired/);
  assert.equal(expired, true);
});

test('Permission errors do not log out a valid session', async () => {
  let expired = false;
  const api = createApi('petugas-token', () => { expired = true; }, async () => response(403, { success: false, message: 'Insufficient permissions' }));
  await assert.rejects(api('/accounts'), /Insufficient permissions/);
  assert.equal(expired, false);
});

test('Connection failure gives a useful error without inventing demo data', async () => {
  const api = createApi('token', undefined, async () => { throw new Error('Failed to fetch'); });
  await assert.rejects(api('/cameras'), /Backend tidak dapat dijangkau/);
});

test('Camera connected=false is a successful connection-check result', async () => {
  const api = createApi('token', undefined, async () => response(200, { success: true, connected: false, reason: 'Connection timed out' }));
  const result = await api('/cameras/id/connection-status');
  assert.equal(result.connected, false);
});
