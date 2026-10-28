import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSpecs } from './engine.js';
import { generateContractTests } from './test-generator.js';

import * as fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixtureDir = fs.existsSync(path.resolve(__dirname, '..'))
  ? path.resolve(__dirname, '..')
  : path.resolve(__dirname, '..');

const v1Path = path.join(fixtureDir, 'petstore-v1.json');
const v2BreakingPath = path.join(fixtureDir, 'petstore-v2-breaking.json');

test('ContractWatch Generator: synthesizes executable contract tests for breaking changes', () => {
  const diff = compareSpecs(v1Path, v2BreakingPath);
  const tests = generateContractTests(diff.changes, { baseUrl: 'http://api.example.com' });

  assert.ok(tests.length >= 5, 'Should generate tests for all detected breaking changes');

  // Verify test targeting endpoint removal
  const epTest = tests.find((t) => t.changeCategory === 'ENDPOINT_REMOVED');
  assert.ok(epTest, 'Should have test for removed endpoint');
  assert.equal(epTest?.targetPath, '/orders');
  assert.ok(epTest?.testCode.includes("assert.notEqual(res.status, 404"), 'Test must assert 404 violation');

  // Verify test targeting missing required body field
  const bodyTest = tests.find((t) => t.changeCategory === 'REQUEST_BODY_REQUIRED_FIELD_ADDED');
  assert.ok(bodyTest, 'Should have test for newly required body field');
  assert.ok(bodyTest?.testCode.includes("urgency"), 'Test must reference the field name');
  assert.ok(bodyTest?.testCode.includes("assert.notEqual(res.status, 422"), 'Test must assert 422/400 violation');

  // Verify test targeting removed response property
  const respTest = tests.find((t) => t.changeCategory === 'RESPONSE_PROPERTY_REMOVED');
  assert.ok(respTest, 'Should have test for removed response property');
  assert.ok(respTest?.testCode.includes("'status' in data"), 'Test must assert presence of property status');
});
