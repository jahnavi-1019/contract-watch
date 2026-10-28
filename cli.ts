#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compareSpecs } from './engine.js';
import { generateContractTests } from './test-generator.js';
import { executeContractTests } from './executor.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

function printBanner() {
  console.log(`\n${BOLD}${CYAN}🔍 ContractWatch - API Breaking Change & Contract Engine${RESET}`);
  console.log(`${GRAY}Verifiable API compatibility and automated consumer contract tests${RESET}\n`);
}

function printHelp() {
  printBanner();
  console.log(`Usage: contract-watch <command> [options]\n`);
  console.log(`Commands:`);
  console.log(`  diff <base-spec> <head-spec>       Compare two OpenAPI specs for breaking changes`);
  console.log(`  generate <base-spec> <head-spec>   Synthesize executable contract tests from diff`);
  console.log(`  verify <base-spec> <head-spec>     Execute contract tests dynamically against server\n`);
  console.log(`Options:`);
  console.log(`  --json                             Output results as raw JSON`);
  console.log(`  --out-dir <dir>                    Output directory for generated contract test files`);
  console.log(`  --base-url <url>                   Base target URL for generated tests (default: http://localhost:3000)`);
  console.log(`  --server-url <url>                 Server endpoint for verify command`);
  console.log(`  --help                             Display this help message\n`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const isJson = args.includes('--json');

  if (command === 'diff') {
    const baseSpec = args[1];
    const headSpec = args[2];

    if (!baseSpec || !headSpec) {
      console.error(`${RED}Error: diff requires <base-spec> and <head-spec> paths.${RESET}`);
      process.exit(1);
    }

    try {
      const result = compareSpecs(baseSpec, headSpec);

      if (isJson) {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.summary.breakingCount > 0 ? 1 : 0);
      }

      printBanner();
      console.log(`Base Spec Version: ${BOLD}${result.baseVersion}${RESET}`);
      console.log(`Head Spec Version: ${BOLD}${result.headVersion}${RESET}`);
      console.log(`Timestamp:         ${GRAY}${result.timestamp}${RESET}\n`);

      console.log(`${BOLD}Summary:${RESET}`);
      console.log(`  Total Changes:   ${result.summary.totalChanges}`);
      console.log(`  Breaking:        ${result.summary.breakingCount > 0 ? RED : GREEN}${result.summary.breakingCount}${RESET}`);
      console.log(`  Warnings:        ${YELLOW}${result.summary.warnCount}${RESET}`);
      console.log(`  Informational:   ${CYAN}${result.summary.infoCount}${RESET}\n`);

      if (result.changes.length === 0) {
        console.log(`${GREEN}✔ No changes detected. Specs are identical.${RESET}\n`);
        process.exit(0);
      }

      console.log(`${BOLD}Detailed Changes:${RESET}`);
      for (const change of result.changes) {
        const badge =
          change.severity === 'BREAKING'
            ? `${RED}[BREAKING]${RESET}`
            : change.severity === 'WARN'
            ? `${YELLOW}[WARN]    ${RESET}`
            : `${CYAN}[INFO]    ${RESET}`;

        console.log(`\n  ${badge} ${BOLD}${change.category}${RESET} on ${CYAN}${change.method} ${change.path}${RESET}`);
        console.log(`    ${GRAY}Description:${RESET} ${change.description}`);
        console.log(`    ${GRAY}Impact:${RESET}      ${change.consumerImpact}`);
        console.log(`    ${GRAY}Remediation:${RESET} ${change.remediation}`);
      }

      console.log('\n--------------------------------------------------------------');
      if (result.summary.breakingCount > 0) {
        console.log(`${RED}${BOLD}✖ Failure: ${result.summary.breakingCount} breaking change(s) detected!${RESET}\n`);
        process.exit(1);
      } else {
        console.log(`${GREEN}${BOLD}✔ Success: API evolution is fully backwards-compatible.${RESET}\n`);
        process.exit(0);
      }
    } catch (err: any) {
      console.error(`${RED}Error analyzing specifications: ${err.message}${RESET}`);
      process.exit(1);
    }
  } else if (command === 'generate') {
    const baseSpec = args[1];
    const headSpec = args[2];
    const outDirIndex = args.indexOf('--out-dir');
    const outDir = outDirIndex !== -1 ? args[outDirIndex + 1] : './contract-tests';
    const baseUrlIndex = args.indexOf('--base-url');
    const baseUrl = baseUrlIndex !== -1 ? args[baseUrlIndex + 1] : 'http://localhost:3000';

    if (!baseSpec || !headSpec) {
      console.error(`${RED}Error: generate requires <base-spec> and <head-spec> paths.${RESET}`);
      process.exit(1);
    }

    try {
      const diff = compareSpecs(baseSpec, headSpec);
      const tests = generateContractTests(diff.changes, { baseUrl });

      if (isJson) {
        console.log(JSON.stringify(tests, null, 2));
        process.exit(0);
      }

      printBanner();
      console.log(`Synthesizing consumer contract tests into: ${BOLD}${outDir}${RESET}\n`);

      fs.mkdirSync(outDir, { recursive: true });

      for (let i = 0; i < tests.length; i++) {
        const t = tests[i];
        const filename = `${String(i + 1).padStart(2, '0')}-${t.changeCategory.toLowerCase()}.test.js`;
        const filePath = path.join(outDir, filename);
        fs.writeFileSync(filePath, t.testCode, 'utf-8');
        console.log(`  ${GREEN}✔ Generated:${RESET} ${filePath} (${t.name})`);
      }

      console.log(`\n${GREEN}${BOLD}✔ Successfully generated ${tests.length} executable contract tests!${RESET}\n`);
    } catch (err: any) {
      console.error(`${RED}Error generating contract tests: ${err.message}${RESET}`);
      process.exit(1);
    }
  } else if (command === 'verify') {
    const baseSpec = args[1];
    const headSpec = args[2];
    const serverUrlIndex = args.indexOf('--server-url');
    const serverUrl = serverUrlIndex !== -1 ? args[serverUrlIndex + 1] : undefined;

    if (!baseSpec || !headSpec || !serverUrl) {
      console.error(`${RED}Error: verify requires <base-spec>, <head-spec>, and --server-url <url>${RESET}`);
      process.exit(1);
    }

    try {
      printBanner();
      console.log(`Comparing specs and executing tests against: ${BOLD}${serverUrl}${RESET}\n`);
      const diff = compareSpecs(baseSpec, headSpec);
      const tests = generateContractTests(diff.changes, { baseUrl: serverUrl });

      const report = await executeContractTests(tests, serverUrl);

      if (isJson) {
        console.log(JSON.stringify(report, null, 2));
        process.exit(report.failed > 0 ? 1 : 0);
      }

      console.log(`${BOLD}Verification Results:${RESET}`);
      console.log(`  Total Executed: ${report.total}`);
      console.log(`  Passed:         ${GREEN}${report.passed}${RESET}`);
      console.log(`  Failed:         ${report.failed > 0 ? RED : GREEN}${report.failed}${RESET}\n`);

      for (const res of report.results) {
        const statusBadge = res.passed ? `${GREEN}[PASS]${RESET}` : `${RED}[FAIL]${RESET}`;
        console.log(`  ${statusBadge} ${res.name} (${res.durationMs}ms)`);
        if (!res.passed && res.error) {
          console.log(`    ${RED}Reason: ${res.error}${RESET}`);
        }
      }

      if (report.failed > 0) {
        console.log(`\n${RED}${BOLD}✖ Verification Failed: Server broke ${report.failed} consumer contract(s).${RESET}\n`);
        process.exit(1);
      } else {
        console.log(`\n${GREEN}${BOLD}✔ Verification Succeeded: All consumer contracts satisfied!${RESET}\n`);
        process.exit(0);
      }
    } catch (err: any) {
      console.error(`${RED}Error running verification: ${err.message}${RESET}`);
      process.exit(1);
    }
  } else {
    console.error(`${RED}Unknown command: ${command}${RESET}`);
    printHelp();
    process.exit(1);
  }
}

main();
