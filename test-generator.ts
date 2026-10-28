import { BreakingChange, SyntheticContractTest } from './types.js';

/**
 * Generate executable consumer contract test suites from breaking change detections.
 */
export function generateContractTests(
  changes: BreakingChange[],
  options?: { baseUrl?: string; framework?: 'node-test' | 'jest' }
): SyntheticContractTest[] {
  const framework = options?.framework || 'node-test';
  const baseUrl = options?.baseUrl || 'http://localhost:3000';
  const tests: SyntheticContractTest[] = [];

  for (const change of changes) {
    if (change.severity !== 'BREAKING') continue;

    let testName = `Contract Test: ${change.category} on ${change.method} ${change.path}`;
    let testCode = '';

    const reqPayload = {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      params: {} as Record<string, string>,
      query: {} as Record<string, string>,
      body: undefined as any,
    };

    const expResp = {
      statusCode: 200,
      requiredProperties: [] as string[],
    };

    switch (change.category) {
      case 'ENDPOINT_REMOVED':
        testCode = `
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('${testName}', async () => {
  const url = '${baseUrl}${change.path}';
  const res = await fetch(url, { method: '${change.method === 'ALL' ? 'GET' : change.method}' });
  // Consumer contract asserts that legacy endpoint must NOT return 404
  assert.notEqual(res.status, 404, 'Endpoint was removed! Consumer contract violated.');
});
`.trim();
        tests.push({
          id: `TEST_${change.id}`,
          name: testName,
          targetPath: change.path,
          targetMethod: change.method,
          changeCategory: change.category,
          requestPayload: reqPayload,
          expectedResponse: { statusCode: 200 },
          testCode,
        });
        break;

      case 'REQUEST_PARAM_ADDED':
        testCode = `
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('${testName}', async () => {
  // Consumer sends request WITHOUT new required parameter '${change.field}'
  const url = '${baseUrl}${change.path}';
  const res = await fetch(url, { 
    method: '${change.method}',
    headers: { 'Accept': 'application/json' }
  });
  // Consumer contract expects success or backwards-compatible default handling, not 400 rejection
  assert.notEqual(res.status, 400, 'Provider rejected request missing newly required parameter: ${change.field}');
});
`.trim();
        tests.push({
          id: `TEST_${change.id}`,
          name: testName,
          targetPath: change.path,
          targetMethod: change.method,
          changeCategory: change.category,
          requestPayload: reqPayload,
          expectedResponse: { statusCode: 200 },
          testCode,
        });
        break;

      case 'REQUEST_BODY_REQUIRED_FIELD_ADDED':
        reqPayload.body = { test_client: 'legacy_consumer_v1' };
        testCode = `
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('${testName}', async () => {
  // Consumer sends legacy payload missing newly required field '${change.field}'
  const url = '${baseUrl}${change.path}';
  const legacyPayload = ${JSON.stringify(reqPayload.body)};
  const res = await fetch(url, {
    method: '${change.method}',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(legacyPayload)
  });
  assert.notEqual(res.status, 422, 'Server rejected legacy payload missing new required field: ${change.field}');
  assert.notEqual(res.status, 400, 'Server rejected legacy payload missing new required field: ${change.field}');
});
`.trim();
        tests.push({
          id: `TEST_${change.id}`,
          name: testName,
          targetPath: change.path,
          targetMethod: change.method,
          changeCategory: change.category,
          requestPayload: reqPayload,
          expectedResponse: { statusCode: 200 },
          testCode,
        });
        break;

      case 'RESPONSE_PROPERTY_REMOVED':
        expResp.requiredProperties = [change.field || ''];
        testCode = `
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('${testName}', async () => {
  const url = '${baseUrl}${change.path}';
  const res = await fetch(url, {
    method: '${change.method}',
    headers: { 'Accept': 'application/json' }
  });
  assert.equal(res.status, 200, 'Expected HTTP 200 response');
  const data = await res.json();
  assert.ok(data && typeof data === 'object', 'Response must be a JSON object');
  assert.ok(
    '${change.field}' in data, 
    'Consumer contract violated: expected response field \\'${change.field}\\' is missing from response.'
  );
});
`.trim();
        tests.push({
          id: `TEST_${change.id}`,
          name: testName,
          targetPath: change.path,
          targetMethod: change.method,
          changeCategory: change.category,
          requestPayload: reqPayload,
          expectedResponse: expResp,
          testCode,
        });
        break;

      case 'RESPONSE_PROPERTY_TYPE_CHANGED':
        testCode = `
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('${testName}', async () => {
  const url = '${baseUrl}${change.path}';
  const res = await fetch(url, {
    method: '${change.method}',
    headers: { 'Accept': 'application/json' }
  });
  assert.equal(res.status, 200, 'Expected HTTP 200 response');
  const data = await res.json();
  const actualType = typeof data['${change.field}'];
  assert.equal(
    actualType,
    '${change.oldValue}',
    'Field \\'${change.field}\\' changed type from expected \\'${change.oldValue}\\' to \\'${change.newValue}\\'.'
  );
});
`.trim();
        tests.push({
          id: `TEST_${change.id}`,
          name: testName,
          targetPath: change.path,
          targetMethod: change.method,
          changeCategory: change.category,
          requestPayload: reqPayload,
          expectedResponse: expResp,
          testCode,
        });
        break;

      default:
        testCode = `
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('${testName}', async () => {
  const url = '${baseUrl}${change.path}';
  const res = await fetch(url, { method: '${change.method}' });
  assert.ok(res.status < 400, 'Unexpected HTTP error response');
});
`.trim();
        tests.push({
          id: `TEST_${change.id}`,
          name: testName,
          targetPath: change.path,
          targetMethod: change.method,
          changeCategory: change.category,
          requestPayload: reqPayload,
          expectedResponse: expResp,
          testCode,
        });
        break;
    }
  }

  return tests;
}
