import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Contract Test: ENDPOINT_REMOVED on ALL /orders', async () => {
  const url = 'http://localhost:3000/orders';
  const res = await fetch(url, { method: 'GET' });
  // Consumer contract asserts that legacy endpoint must NOT return 404
  assert.notEqual(res.status, 404, 'Endpoint was removed! Consumer contract violated.');
});