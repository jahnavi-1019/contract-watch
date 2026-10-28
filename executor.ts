import { SyntheticContractTest } from './types.js';

export interface TestExecutionResult {
  testId: string;
  name: string;
  passed: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
}

export interface VerificationReport {
  total: number;
  passed: number;
  failed: number;
  results: TestExecutionResult[];
}

/**
 * Executes synthetic contract tests dynamically against a target server
 */
export async function executeContractTests(
  tests: SyntheticContractTest[],
  baseUrl: string
): Promise<VerificationReport> {
  const results: TestExecutionResult[] = [];

  for (const t of tests) {
    const start = Date.now();
    const url = `${baseUrl.replace(/\/$/, '')}${t.targetPath}`;

    try {
      const options: RequestInit = {
        method: t.targetMethod === 'ALL' ? 'GET' : t.targetMethod,
        headers: t.requestPayload.headers,
      };

      if (t.requestPayload.body && ['POST', 'PUT', 'PATCH'].includes(options.method!)) {
        options.body = JSON.stringify(t.requestPayload.body);
      }

      const response = await fetch(url, options);
      const durationMs = Date.now() - start;

      let passed = true;
      let errorMsg: string | undefined;

      // Evaluate contract expectation
      if (t.changeCategory === 'ENDPOINT_REMOVED' && response.status === 404) {
        passed = false;
        errorMsg = 'Endpoint returned 404 Not Found (Endpoint was removed from server)';
      } else if (
        t.changeCategory === 'REQUEST_BODY_REQUIRED_FIELD_ADDED' &&
        [400, 422].includes(response.status)
      ) {
        passed = false;
        errorMsg = `Server rejected request with status ${response.status} (Missing newly required field)`;
      } else if (t.expectedResponse.requiredProperties?.length) {
        try {
          const json = (await response.json()) as Record<string, any>;
          for (const reqProp of t.expectedResponse.requiredProperties) {
            if (!(reqProp in json)) {
              passed = false;
              errorMsg = `Response payload missing expected property: '${reqProp}'`;
              break;
            }
          }
        } catch {
          passed = false;
          errorMsg = 'Response body was not valid JSON';
        }
      }

      results.push({
        testId: t.id,
        name: t.name,
        passed,
        statusCode: response.status,
        error: errorMsg,
        durationMs,
      });
    } catch (err: any) {
      results.push({
        testId: t.id,
        name: t.name,
        passed: false,
        error: `Network / Fetch Error: ${err.message}`,
        durationMs: Date.now() - start,
      });
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: tests.length,
    passed: passedCount,
    failed: tests.length - passedCount,
    results,
  };
}
