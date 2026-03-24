/**
 * Recursively converts object keys from snake_case to camelCase.
 * Handles null, undefined, arrays, Date, and non-plain objects safely.
 */
export function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== 'object' || obj instanceof Date) return obj;
  // Only process plain objects — skip class instances, RegExp, etc.
  if (obj.constructor !== undefined && obj.constructor !== Object) return obj;

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
    result[camelKey] = snakeToCamel(obj[key]);
  }
  return result;
}

/**
 * Recursively converts object keys from camelCase to snake_case.
 * Handles null, undefined, arrays, Date, and non-plain objects safely.
 */
export function camelToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (typeof obj !== 'object' || obj instanceof Date) return obj;
  // Only process plain objects — skip class instances, RegExp, etc.
  if (obj.constructor !== undefined && obj.constructor !== Object) return obj;

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    result[snakeKey] = camelToSnake(obj[key]);
  }
  return result;
}
