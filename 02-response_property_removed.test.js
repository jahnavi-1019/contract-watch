import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Contract Test: RESPONSE_PROPERTY_REMOVED on GET /pets', async () => {
  const url = 'http://localhost:3000/pets';
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  assert.equal(res.status, 200, 'Expected HTTP 200 response');
  const data = await res.json();
  assert.ok(data && typeof data === 'object', 'Response must be a JSON object');
  assert.ok(
    'status' in data, 
    'Consumer contract violated: expected response field \'status\' is missing from response.'
  );
});