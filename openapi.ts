import * as fs from 'node:fs';
import * as path from 'node:path';

export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, any>;
    parameters?: Record<string, any>;
    responses?: Record<string, any>;
  };
}

export interface PathItem {
  summary?: string;
  description?: string;
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  parameters?: ParameterObject[];
  [key: string]: any;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  deprecated?: boolean;
}

export interface ParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  schema?: any;
  description?: string;
}

export interface RequestBodyObject {
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface ResponseObject {
  description?: string;
  content?: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema?: any;
  example?: any;
  examples?: Record<string, any>;
}

/**
 * Resolves local references ($ref: '#/components/schemas/...') in an OpenAPI document.
 */
export function resolveRef(ref: string, root: any): any {
  if (!ref.startsWith('#/')) {
    return null; // External refs handled separately if needed
  }
  const parts = ref.substring(2).split('/');
  let current = root;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

/**
 * Recursively deep-resolves schemas in an object
 */
export function expandSchema(schema: any, root: any, depth = 0): any {
  if (!schema || typeof schema !== 'object' || depth > 10) {
    return schema;
  }

  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, root);
    if (resolved) {
      return expandSchema({ ...resolved, ...schema, $ref: undefined }, root, depth + 1);
    }
  }

  if (schema.type === 'object' && schema.properties) {
    const properties: Record<string, any> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      properties[key] = expandSchema(prop, root, depth + 1);
    }
    return { ...schema, properties };
  }

  if (schema.type === 'array' && schema.items) {
    return {
      ...schema,
      items: expandSchema(schema.items, root, depth + 1),
    };
  }

  return schema;
}

/**
 * Load and validate an OpenAPI document from a file or object
 */
export function loadSpec(input: string | object): OpenAPISpec {
  let spec: OpenAPISpec;
  if (typeof input === 'string') {
    const fullPath = path.resolve(input);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`OpenAPI specification file not found: ${fullPath}`);
    }
    const raw = fs.readFileSync(fullPath, 'utf-8');
    try {
      spec = JSON.parse(raw);
    } catch {
      throw new Error(`Failed to parse OpenAPI JSON from ${fullPath}`);
    }
  } else {
    spec = input as OpenAPISpec;
  }

  if (!spec.paths || typeof spec.paths !== 'object') {
    throw new Error('Invalid OpenAPI spec: missing required "paths" object.');
  }

  return spec;
}
