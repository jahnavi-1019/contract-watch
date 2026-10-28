import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSpecs } from './engine.js';
import { generateContractTests } from './test-generator.js';
import { executeContractTests } from './executor.js';

import * as fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixtureDir = fs.existsSync(path.resolve(__dirname, '..'))
  ? path.resolve(__dirname, '..')
  : path.resolve(__dirname, '..');

const v1Path = path.join(fixtureDir, 'petstore-v1.json');
const v2BreakingPath = path.join(fixtureDir, 'petstore-v2-breaking.json');

test('ContractWatch Executor: catches live contract violations on dynamic server', async () => {
  // 1. Create a mock HTTP server exhibiting breaking changes
  const server = http.createServer((req, res) => {
    if (req.url === '/orders') {
      // Breaking: endpoint removed, returns 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    if (req.url === '/pets' && req.method === 'GET') {
      // Breaking: missing 'status' field in response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ items: [], total: 0 }));
      return;
    }

    if (req.url === '/pets' && req.method === 'POST') {
      // Breaking: rejects legacy payload without 'urgency'
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required field: urgency' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'OK' }));
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  try {
    const diff = compareSpecs(v1Path, v2BreakingPath);
    const tests = generateContractTests(diff.changes, { baseUrl });

    const report = await executeContractTests(tests, baseUrl);

    assert.ok(report.total >= 3, 'Should have executed multiple tests');
    assert.ok(report.failed >= 2, 'Should fail tests for broken endpoints');

    const epFail = report.results.find((r) => r.name.includes('/orders'));
    assert.ok(epFail && !epFail.passed, 'Test for /orders must fail');
    assert.ok(epFail?.error?.includes('404 Not Found'), 'Must report 404 failure reason');
  } finally {
    server.close();
  }
});
