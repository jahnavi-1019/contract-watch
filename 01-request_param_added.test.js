import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Contract Test: REQUEST_PARAM_ADDED on GET /pets', async () => {
  // Consumer sends request WITHOUT new required parameter 'apiKey'
  const url = 'http://localhost:3000/pets';
  const res = await fetch(url, { 
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  // Consumer contract expects success or backwards-compatible default handling, not 400 rejection
  assert.notEqual(res.status, 400, 'Provider rejected request missing newly required parameter: apiKey');
});