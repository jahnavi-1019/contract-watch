# 🔍 ContractWatch

> **API Compatibility Checker & Consumer Contract Test Generator**  
> *Defensible API Governance for Modern CI/CD Pipelines*

[![CI](https://github.com/user/contract-watch/actions/workflows/ci.yml/badge.svg)](https://github.com/user/contract-watch)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js: >=20.0.0](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-blue)](https://www.typescriptlang.org)

---

## 📌 Problem Statement

Upstream API breaking changes frequently slip through code reviews, causing cascading production failures across frontend clients, mobile apps, and dependent microservices. 

Existing tools present significant limitations:
- **Schema Differs (`oasdiff`, `openapi-diff`)** only perform passive static text comparisons. They report that a field was removed, but cannot verify whether downstream consumer behaviors actually break.
- **Consumer Contract Testing (`Pact`, `PactFlow`)** requires client teams to manually author, version, and broker complex contract files, creating severe organizational adoption barriers.

**ContractWatch bridges this gap.** It parses OpenAPI 3.0 and 3.1 specifications, identifies breaking semantic evolutions using a formal taxonomy, and **automatically synthesizes executable consumer contract tests** that run dynamically against staging servers or local mocks to verify contract compliance.

---

## 🏛️ Architecture & Processing Pipeline

```
  Base OpenAPI Spec (main) ──┐
                             ├─► [Parser & Ref Resolver] ──► [Diff Engine & Rule Matrix]
  Head OpenAPI Spec (PR)   ──┘                                       │
                                                                     ├─► [Breaking Change Report]
                                                                     │   (CLI / JSON / GitHub Status)
                                                                     │
                                                                     └─► [Contract Test Synthesizer]
                                                                                 │
                                                                                 ├─► Executable Node.js / Jest Suites
                                                                                 │
                                                                                 └─► [Dynamic Test Runner] ──► Target API
```

### Core Components
1. **Schema Parser & Reference Resolver (`src/parser/`):** Deeply resolves JSON `$ref` pointers within components, normalizing path parameters, operation objects, and recursive schemas.
2. **Semantic Breaking Change Engine (`src/diff/`):** Evaluates AST modifications against a formal rule matrix covering removed operations, altered parameters, mutated status codes, and type mismatches.
3. **Synthetic Contract Test Generator (`src/generator/`):** Generates standalone, executable test suites that simulate legacy consumer traffic against provider endpoints.
4. **Dynamic Verification Runner (`src/runner/`):** Executes generated contract suites against live staging URLs or mock instances, providing actionable pass/fail assertions.

---

## 📐 Breaking Change Classification Taxonomy

ContractWatch evaluates API evolutions according to the following strict compatibility rules:

| Category | Severity | Failure Scenario | Consumer Impact |
|:---|:---:|:---|:---|
| `ENDPOINT_REMOVED` | 🚨 BREAKING | A path present in base is missing in head | Existing client calls fail with `HTTP 404` |
| `METHOD_REMOVED` | 🚨 BREAKING | An HTTP method is removed from an existing path | Existing clients receive `HTTP 405 Method Not Allowed` |
| `REQUEST_PARAM_ADDED` | 🚨 BREAKING | A new query/header/path parameter is marked `required` | Unaware clients fail validation (`HTTP 400`) |
| `REQUEST_PARAM_TYPE_CHANGED` | 🚨 BREAKING | A parameter type changes (e.g. `string` to `integer`) | Clients sending legacy types fail parameter parsing |
| `REQUEST_BODY_REQUIRED_FIELD_ADDED` | 🚨 BREAKING | A new mandatory property is added to JSON body | Legacy payloads rejected with `HTTP 400` or `422` |
| `RESPONSE_PROPERTY_REMOVED` | 🚨 BREAKING | A field is removed from JSON response body | Downstream client code crashes with `null` / `undefined` |
| `RESPONSE_PROPERTY_TYPE_CHANGED` | 🚨 BREAKING | A response field type changes (e.g. `number` to `string`) | Deserialization and strict type checking exceptions |
| `RESPONSE_STATUS_CODE_CHANGED` | 🚨 BREAKING | Standard `200`/`201` response code is altered | Clients asserting specific status codes fail |
| `ENDPOINT_ADDED` | ℹ️ INFO | A new path or method is added | Fully backwards-compatible addition |

---

## 🚀 Quick Start & CLI Usage

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/contract-watch.git
cd contract-watch

# Install dependencies and build
npm install
npm run build
```

### 1. Compare Two OpenAPI Specs
```bash
node dist/src/cli.js diff specs/v1.json specs/v2.json
```
*Output:*
```
🔍 ContractWatch - API Breaking Change & Contract Engine
Verifiable API compatibility and automated consumer contract tests

Base Spec Version: 1.0.0
Head Spec Version: 2.0.0

Summary:
  Total Changes:   6
  Breaking:        6
  Warnings:        0
  Informational:   0

Detailed Changes:

  [BREAKING] REQUEST_PARAM_ADDED on GET /pets
    Description: New required header parameter 'apiKey' was added.
    Impact:      Existing client requests lacking 'apiKey' will be rejected with HTTP 400.
    Remediation: Make 'apiKey' optional with a sensible default value.

  [BREAKING] RESPONSE_PROPERTY_REMOVED on GET /pets
    Description: Property 'status' was removed from HTTP 200 JSON response body.
    Impact:      Downstream clients accessing 'response.status' will encounter null pointer or undefined errors.
    Remediation: Keep 'status' present (mark as deprecated) until all clients migrate.

✖ Failure: 6 breaking change(s) detected!
```

### 2. Synthesize Executable Consumer Contract Tests
```bash
node dist/src/cli.js generate specs/v1.json specs/v2.json --out-dir ./generated-tests --base-url http://api.staging.example.com
```

### 3. Verify Live Server Compatibility
```bash
node dist/src/cli.js verify specs/v1.json specs/v2.json --server-url http://localhost:3000
```

---

## 💻 Programmatic TypeScript API

```typescript
import { compareSpecs, generateContractTests, executeContractTests } from '@portfolio/contract-watch';

// 1. Evaluate breaking changes programmatically
const diff = compareSpecs('path/to/base.json', 'path/to/head.json');
console.log(`Compatible: ${diff.summary.isCompatible}`);

// 2. Synthesize contract test cases
const tests = generateContractTests(diff.changes, { baseUrl: 'http://localhost:3000' });

// 3. Execute against live staging server
const report = await executeContractTests(tests, 'http://localhost:3000');
console.log(`Passed: ${report.passed} / ${report.total}`);
```

---

## 🧪 Automated Testing & Evaluation

ContractWatch comes with a comprehensive test suite executed natively using Node.js's built-in test runner:

```bash
npm run test
```

### Verification Results
```
✔ ContractWatch Diff: detects backwards-compatible evolution (4.2ms)
✔ ContractWatch Diff: accurately classifies all breaking change categories (1.6ms)
✔ ContractWatch Executor: catches live contract violations on dynamic server (86.3ms)
✔ ContractWatch Generator: synthesizes executable contract tests for breaking changes (6.5ms)

ℹ tests 4
ℹ pass 4
ℹ fail 0
ℹ duration_ms 295.18
```

---

## 🔄 GitHub Actions CI/CD Integration

Add `.github/workflows/api-contract-guard.yml` to your repository:

```yaml
name: API Contract Guard

on:
  pull_request:
    paths:
      - 'openapi.yaml'
      - 'openapi.json'

jobs:
  check-api-compatibility:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout PR Branch
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install ContractWatch
        run: npm install -g @portfolio/contract-watch

      - name: Extract Base Spec from Target Branch
        run: git show origin/main:openapi.json > base-spec.json

      - name: Verify Compatibility
        run: contract-watch diff base-spec.json openapi.json
```

---

## 📄 License
MIT © Antigravity Engineering
