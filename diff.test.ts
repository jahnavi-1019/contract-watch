import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSpecs } from './engine.js';

import * as fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixtureDir = fs.existsSync(path.resolve(__dirname, '..'))
  ? path.resolve(__dirname, '..')
  : path.resolve(__dirname, '..');

const v1Path = path.join(fixtureDir, 'petstore-v1.json');
const v2CompatiblePath = path.join(fixtureDir, 'petstore-v2-compatible.json');
const v2BreakingPath = path.join(fixtureDir, 'petstore-v2-breaking.json');

test('ContractWatch Diff: detects backwards-compatible evolution', () => {
  const diff = compareSpecs(v1Path, v2CompatiblePath);

  assert.equal(diff.summary.isCompatible, true, 'Evolution should be compatible');
  assert.equal(diff.summary.breakingCount, 0, 'Breaking change count must be 0');
  assert.ok(diff.summary.infoCount >= 1, 'Should record informational changes (new endpoint)');

  const epAdded = diff.changes.find((c) => c.category === 'ENDPOINT_ADDED');
  assert.ok(epAdded, 'Should identify newly added endpoint /categories');
  assert.equal(epAdded?.path, '/categories');
});

test('ContractWatch Diff: accurately classifies all breaking change categories', () => {
  const diff = compareSpecs(v1Path, v2BreakingPath);

  assert.equal(diff.summary.isCompatible, false, 'Evolution must be marked breaking');
  assert.ok(diff.summary.breakingCount >= 5, 'Should identify at least 5 breaking changes');

  // 1. Endpoint removed
  const epRemoved = diff.changes.find((c) => c.category === 'ENDPOINT_REMOVED');
  assert.ok(epRemoved, 'Must catch removed /orders endpoint');
  assert.equal(epRemoved?.path, '/orders');

  // 2. Method removed
  const methodRemoved = diff.changes.find((c) => c.category === 'METHOD_REMOVED');
  assert.ok(methodRemoved, 'Must catch removed DELETE method on /pets/{id}');
  assert.equal(methodRemoved?.path, '/pets/{id}');
  assert.equal(methodRemoved?.method, 'DELETE');

  // 3. Required parameter added
  const reqParam = diff.changes.find((c) => c.category === 'REQUEST_PARAM_ADDED');
  assert.ok(reqParam, 'Must catch newly required header apiKey');
  assert.equal(reqParam?.field, 'apiKey');

  // 4. Required request body field added
  const reqBodyField = diff.changes.find((c) => c.category === 'REQUEST_BODY_REQUIRED_FIELD_ADDED');
  assert.ok(reqBodyField, 'Must catch newly required body field urgency');
  assert.equal(reqBodyField?.field, 'urgency');

  // 5. Response property removed
  const respPropRemoved = diff.changes.find((c) => c.category === 'RESPONSE_PROPERTY_REMOVED');
  assert.ok(respPropRemoved, 'Must catch removed response field status');
  assert.equal(respPropRemoved?.field, 'status');

  // 6. Response property type changed
  const respPropType = diff.changes.find((c) => c.category === 'RESPONSE_PROPERTY_TYPE_CHANGED');
  assert.ok(respPropType, 'Must catch price changing from number to string');
  assert.equal(respPropType?.field, 'price');
  assert.equal(respPropType?.oldValue, 'number');
  assert.equal(respPropType?.newValue, 'string');
});
