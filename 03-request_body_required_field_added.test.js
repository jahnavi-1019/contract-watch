import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Contract Test: REQUEST_BODY_REQUIRED_FIELD_ADDED on POST /pets', async () => {
  // Consumer sends legacy payload missing newly required field 'urgency'
  const url = 'http://localhost:3000/pets';
  const legacyPayload = {"test_client":"legacy_consumer_v1"};
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(legacyPayload)
  });
  assert.notEqual(res.status, 422, 'Server rejected legacy payload missing new required field: urgency');
  assert.notEqual(res.status, 400, 'Server rejected legacy payload missing new required field: urgency');
});