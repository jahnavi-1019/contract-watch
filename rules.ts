import {
  OpenAPISpec,
  OperationObject,
  ParameterObject,
  expandSchema,
} from './openapi.js';
import { BreakingChange } from './types.js';

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;

/**
 * Compare two OpenAPI specifications and identify breaking / warning changes.
 */
export function evaluateRules(baseSpec: OpenAPISpec, headSpec: OpenAPISpec): BreakingChange[] {
  const changes: BreakingChange[] = [];

  // 1. Check for removed endpoints
  for (const [pathStr, basePathItem] of Object.entries(baseSpec.paths)) {
    const headPathItem = headSpec.paths[pathStr];
    if (!headPathItem) {
      changes.push({
        id: `EP_REMOVED_${pathStr.replace(/[^a-zA-Z0-9]/g, '_')}`,
        category: 'ENDPOINT_REMOVED',
        severity: 'BREAKING',
        path: pathStr,
        method: 'ALL',
        description: `Path '${pathStr}' was completely removed in head revision.`,
        consumerImpact: `All client calls to '${pathStr}' will fail with HTTP 404.`,
        remediation: `Restore the endpoint or provide an automated redirect / deprecation grace period.`,
      });
      continue;
    }

    // 2. Check for removed HTTP methods on existing paths
    for (const method of HTTP_METHODS) {
      const baseOp = (basePathItem as any)[method] as OperationObject | undefined;
      const headOp = (headPathItem as any)[method] as OperationObject | undefined;

      if (baseOp && !headOp) {
        changes.push({
          id: `METHOD_REMOVED_${method.toUpperCase()}_${pathStr.replace(/[^a-zA-Z0-9]/g, '_')}`,
          category: 'METHOD_REMOVED',
          severity: 'BREAKING',
          path: pathStr,
          method: method.toUpperCase(),
          description: `HTTP method '${method.toUpperCase()}' was removed from path '${pathStr}'.`,
          consumerImpact: `Existing clients issuing ${method.toUpperCase()} requests will receive HTTP 405 Method Not Allowed.`,
          remediation: `Maintain the operation with a deprecation header or preserve the endpoint handler.`,
        });
        continue;
      }

      if (baseOp && headOp) {
        // 3. Check parameters
        compareParameters(pathStr, method.toUpperCase(), baseOp, headOp, changes);

        // 4. Check request bodies
        compareRequestBodies(pathStr, method.toUpperCase(), baseOp, headOp, baseSpec, headSpec, changes);

        // 5. Check responses
        compareResponses(pathStr, method.toUpperCase(), baseOp, headOp, baseSpec, headSpec, changes);
      }
    }
  }

  // 6. Check for newly added endpoints (Informational)
  for (const [pathStr, headPathItem] of Object.entries(headSpec.paths)) {
    if (!baseSpec.paths[pathStr]) {
      changes.push({
        id: `EP_ADDED_${pathStr.replace(/[^a-zA-Z0-9]/g, '_')}`,
        category: 'ENDPOINT_ADDED',
        severity: 'INFO',
        path: pathStr,
        method: 'ALL',
        description: `New endpoint '${pathStr}' added in head revision.`,
        consumerImpact: `Non-breaking addition. New capability available for clients.`,
        remediation: `Update client SDKs and public documentation.`,
      });
    }
  }

  return changes;
}

function compareParameters(
  path: string,
  method: string,
  baseOp: OperationObject,
  headOp: OperationObject,
  changes: BreakingChange[]
) {
  const baseParams = baseOp.parameters || [];
  const headParams = headOp.parameters || [];

  const baseParamMap = new Map<string, ParameterObject>(
    baseParams.map((p) => [`${p.in}:${p.name}`, p])
  );
  const headParamMap = new Map<string, ParameterObject>(
    headParams.map((p) => [`${p.in}:${p.name}`, p])
  );

  // Check for newly added REQUIRED parameters
  for (const [key, headParam] of headParamMap.entries()) {
    const baseParam = baseParamMap.get(key);
    if (!baseParam && headParam.required) {
      changes.push({
        id: `PARAM_REQ_ADDED_${method}_${path}_${headParam.name}`,
        category: 'REQUEST_PARAM_ADDED',
        severity: 'BREAKING',
        path,
        method,
        field: headParam.name,
        description: `New required ${headParam.in} parameter '${headParam.name}' was added.`,
        consumerImpact: `Existing client requests lacking '${headParam.name}' will be rejected with HTTP 400.`,
        remediation: `Make '${headParam.name}' optional with a sensible default value.`,
      });
    } else if (baseParam && !baseParam.required && headParam.required) {
      changes.push({
        id: `PARAM_MADE_REQ_${method}_${path}_${headParam.name}`,
        category: 'REQUEST_PARAM_ADDED',
        severity: 'BREAKING',
        path,
        method,
        field: headParam.name,
        description: `Optional parameter '${headParam.name}' was changed to REQUIRED.`,
        consumerImpact: `Existing client calls omitting '${headParam.name}' will now fail.`,
        remediation: `Keep parameter optional to preserve backward compatibility.`,
      });
    }
  }

  // Check for parameter type changes
  for (const [key, baseParam] of baseParamMap.entries()) {
    const headParam = headParamMap.get(key);
    if (headParam && baseParam.schema && headParam.schema) {
      const baseType = baseParam.schema.type;
      const headType = headParam.schema.type;
      if (baseType && headType && baseType !== headType) {
        changes.push({
          id: `PARAM_TYPE_CHANGED_${method}_${path}_${baseParam.name}`,
          category: 'REQUEST_PARAM_TYPE_CHANGED',
          severity: 'BREAKING',
          path,
          method,
          field: baseParam.name,
          oldValue: baseType,
          newValue: headType,
          description: `Parameter '${baseParam.name}' type changed from '${baseType}' to '${headType}'.`,
          consumerImpact: `Clients sending ${baseType} values will fail validation.`,
          remediation: `Accept union types or maintain legacy parameter format.`,
        });
      }
    }
  }
}

function compareRequestBodies(
  path: string,
  method: string,
  baseOp: OperationObject,
  headOp: OperationObject,
  baseSpec: OpenAPISpec,
  headSpec: OpenAPISpec,
  changes: BreakingChange[]
) {
  const baseReq = baseOp.requestBody;
  const headReq = headOp.requestBody;

  if (!baseReq?.content && headReq?.content && headReq.required) {
    changes.push({
      id: `REQ_BODY_REQUIRED_ADDED_${method}_${path}`,
      category: 'REQUEST_BODY_REQUIRED_FIELD_ADDED',
      severity: 'BREAKING',
      path,
      method,
      description: `Endpoint now mandates a request body where none was previously required.`,
      consumerImpact: `Existing requests without a body payload will receive HTTP 400 or 415.`,
      remediation: `Make request body optional.`,
    });
    return;
  }

  if (baseReq?.content && headReq?.content) {
    const baseJson = baseReq.content['application/json'];
    const headJson = headReq.content['application/json'];
    if (baseJson?.schema && headJson?.schema) {
      const baseSchema = expandSchema(baseJson.schema, baseSpec);
      const headSchema = expandSchema(headJson.schema, headSpec);

      // Check for added required fields in request body
      const baseRequired: string[] = baseSchema.required || [];
      const headRequired: string[] = headSchema.required || [];
      for (const reqField of headRequired) {
        if (!baseRequired.includes(reqField)) {
          changes.push({
            id: `REQ_BODY_REQ_FIELD_${method}_${path}_${reqField}`,
            category: 'REQUEST_BODY_REQUIRED_FIELD_ADDED',
            severity: 'BREAKING',
            path,
            method,
            field: reqField,
            description: `Required property '${reqField}' was added to JSON request body.`,
            consumerImpact: `Existing clients sending payloads without '${reqField}' will be rejected with HTTP 422/400.`,
            remediation: `Make '${reqField}' optional with a server-side default.`,
          });
        }
      }
    }
  }
}

function compareResponses(
  path: string,
  method: string,
  baseOp: OperationObject,
  headOp: OperationObject,
  baseSpec: OpenAPISpec,
  headSpec: OpenAPISpec,
  changes: BreakingChange[]
) {
  // Check for removed successful status codes (e.g., 200, 201)
  for (const [code, baseResp] of Object.entries(baseOp.responses)) {
    const headResp = headOp.responses[code];
    if (!headResp && code.startsWith('2')) {
      changes.push({
        id: `RESP_STATUS_REMOVED_${method}_${path}_${code}`,
        category: 'RESPONSE_STATUS_CODE_CHANGED',
        severity: 'BREAKING',
        path,
        method,
        description: `Success response HTTP ${code} was removed or replaced.`,
        consumerImpact: `Clients asserting HTTP ${code} will fail when receiving different response status codes.`,
        remediation: `Maintain standard ${code} response code support.`,
      });
      continue;
    }

    // Check JSON response schema property removal
    const baseContent = baseResp.content?.['application/json'];
    const headContent = headResp?.content?.['application/json'];
    if (baseContent?.schema && headContent?.schema) {
      const baseSchema = expandSchema(baseContent.schema, baseSpec);
      const headSchema = expandSchema(headContent.schema, headSpec);

      if (baseSchema.type === 'object' && headSchema.type === 'object') {
        const baseProps = baseSchema.properties || {};
        const headProps = headSchema.properties || {};

        for (const [propName, baseProp] of Object.entries(baseProps)) {
          if (!headProps[propName]) {
            changes.push({
              id: `RESP_PROP_REMOVED_${method}_${path}_${code}_${propName}`,
              category: 'RESPONSE_PROPERTY_REMOVED',
              severity: 'BREAKING',
              path,
              method,
              field: propName,
              description: `Property '${propName}' was removed from HTTP ${code} JSON response body.`,
              consumerImpact: `Downstream clients accessing 'response.${propName}' will encounter null pointer or undefined errors.`,
              remediation: `Keep '${propName}' present (mark as deprecated) until all clients migrate.`,
            });
          } else {
            // Check property type mutation
            const baseType = (baseProp as any).type;
            const headType = (headProps[propName] as any).type;
            if (baseType && headType && baseType !== headType) {
              changes.push({
                id: `RESP_PROP_TYPE_CHANGED_${method}_${path}_${code}_${propName}`,
                category: 'RESPONSE_PROPERTY_TYPE_CHANGED',
                severity: 'BREAKING',
                path,
                method,
                field: propName,
                oldValue: baseType,
                newValue: headType,
                description: `Property '${propName}' in HTTP ${code} changed type from '${baseType}' to '${headType}'.`,
                consumerImpact: `Strictly-typed SDKs and deserializers will throw parsing/decoding exceptions.`,
                remediation: `Preserve original data type or introduce a versioned response field.`,
              });
            }
          }
        }
      }
    }
  }
}
