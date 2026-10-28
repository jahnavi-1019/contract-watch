/**
 * ContractWatch - Breaking Change & Contract Testing Taxonomy
 */

export type ChangeSeverity = 'BREAKING' | 'WARN' | 'INFO';

export type ChangeCategory =
  | 'ENDPOINT_REMOVED'
  | 'METHOD_REMOVED'
  | 'REQUEST_PARAM_ADDED'
  | 'REQUEST_PARAM_REMOVED'
  | 'REQUEST_PARAM_TYPE_CHANGED'
  | 'REQUEST_BODY_REQUIRED_FIELD_ADDED'
  | 'REQUEST_BODY_TYPE_CHANGED'
  | 'RESPONSE_REMOVED'
  | 'RESPONSE_STATUS_CODE_CHANGED'
  | 'RESPONSE_PROPERTY_REMOVED'
  | 'RESPONSE_PROPERTY_TYPE_CHANGED'
  | 'ENUM_VALUE_REMOVED'
  | 'ENDPOINT_ADDED'
  | 'RESPONSE_PROPERTY_ADDED';

export interface BreakingChange {
  id: string;
  category: ChangeCategory;
  severity: ChangeSeverity;
  path: string;
  method: string;
  field?: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  consumerImpact: string;
  remediation: string;
}

export interface DiffSummary {
  totalChanges: number;
  breakingCount: number;
  warnCount: number;
  infoCount: number;
  isCompatible: boolean;
}

export interface DiffResult {
  baseVersion: string;
  headVersion: string;
  timestamp: string;
  summary: DiffSummary;
  changes: BreakingChange[];
}

export interface SyntheticContractTest {
  id: string;
  name: string;
  targetPath: string;
  targetMethod: string;
  changeCategory: ChangeCategory;
  requestPayload: {
    headers: Record<string, string>;
    params: Record<string, string>;
    query: Record<string, string>;
    body?: any;
  };
  expectedResponse: {
    statusCode: number;
    requiredProperties?: string[];
    schemaCheck?: Record<string, any>;
  };
  testCode: string;
}
