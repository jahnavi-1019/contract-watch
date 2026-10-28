import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Contract Test: RESPONSE_PROPERTY_TYPE_CHANGED on GET /pets/{id}', async () => {
  const url = 'http://localhost:3000/pets/{id}';
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  assert.equal(res.status, 200, 'Expected HTTP 200 response');
  const data = await res.json();
  const actualType = typeof data['price'];
  assert.equal(
    actualType,
    'number',
    'Field \'price\' changed type from expected \'number\' to \'string\'.'
  );
});