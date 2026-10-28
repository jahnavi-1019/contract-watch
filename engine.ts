import { loadSpec } from './openapi.js';
import { evaluateRules } from './rules.js';
import { DiffResult, DiffSummary } from './types.js';

export function compareSpecs(baseInput: string | object, headInput: string | object): DiffResult {
  const baseSpec = loadSpec(baseInput);
  const headSpec = loadSpec(headInput);

  const changes = evaluateRules(baseSpec, headSpec);

  let breakingCount = 0;
  let warnCount = 0;
  let infoCount = 0;

  for (const c of changes) {
    if (c.severity === 'BREAKING') breakingCount++;
    else if (c.severity === 'WARN') warnCount++;
    else if (c.severity === 'INFO') infoCount++;
  }

  const summary: DiffSummary = {
    totalChanges: changes.length,
    breakingCount,
    warnCount,
    infoCount,
    isCompatible: breakingCount === 0,
  };

  return {
    baseVersion: baseSpec.info?.version || 'unknown',
    headVersion: headSpec.info?.version || 'unknown',
    timestamp: new Date().toISOString(),
    summary,
    changes,
  };
}
