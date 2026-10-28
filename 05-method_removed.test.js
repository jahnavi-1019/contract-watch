import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Contract Test: METHOD_REMOVED on DELETE /pets/{id}', async () => {
  const url = 'http://localhost:3000/pets/{id}';
  const res = await fetch(url, { method: 'DELETE' });
  assert.ok(res.status < 400, 'Unexpected HTTP error response');
});