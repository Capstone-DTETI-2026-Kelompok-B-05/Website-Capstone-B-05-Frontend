import test from 'node:test';
import assert from 'node:assert/strict';
import { canNavigate } from '../src/access.js';
test('Petugas is restricted to dashboard even for direct navigation', () => {
  assert.equal(canNavigate('petugas', 'dashboard'), true);
  for (const page of ['cameras', 'accounts', 'password', 'analytics', 'logs']) assert.equal(canNavigate('petugas', page), false);
});
test('Admin can open management pages, unknown routes stay blocked', () => {
  for (const page of ['dashboard', 'cameras', 'accounts', 'password']) assert.equal(canNavigate('admin', page), true);
  assert.equal(canNavigate('admin', 'unknown'), false);
});
