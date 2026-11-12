/**
 * Data-driven conditions for intake questions and document requirements, stored as JSON so
 * the admin can change them without a deploy. Examples:
 *
 *   { "key": "scheme", "op": "eq", "value": "ECO4" }                    show if scheme = ECO4
 *   { "key": "$services", "op": "notIncludes", "value": "RA" }          unless RA is ordered too
 *   { "all": [ { "key": "$tier", "op": "eq", "value": "PARTNER" },
 *              { "key": "scheme", "op": "in", "value": ["ECO4", "GBIS"] } ] }
 *
 * Keys starting with `$` are facts supplied by the system ($tier, $services, $customerType,
 * $propertyTenure); everything else is an intake answer. Dotted paths reach into objects.
 */

export type Operator = "eq" | "neq" | "in" | "notIn" | "includes" | "notIncludes" | "truthy" | "falsy" | "gt" | "gte" | "lt" | "lte";

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { key: string; op: Operator; value?: unknown };

export type ConditionContext = Record<string, unknown>;

const OPERATORS: readonly Operator[] = ["eq", "neq", "in", "notIn", "includes", "notIncludes", "truthy", "falsy", "gt", "gte", "lt", "lte"];

function read(context: ConditionContext, path: string): unknown {
  let current: unknown = context;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]);
const isEmpty = (value: unknown) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/** Evaluate a condition. A null/undefined condition always passes. */
export function evaluate(condition: unknown, context: ConditionContext): boolean {
  if (condition === null || condition === undefined) return true;
  if (!isCondition(condition)) throw new Error(`Invalid condition: ${JSON.stringify(condition)}`);
  if ("all" in condition) return condition.all.every((item) => evaluate(item, context));
  if ("any" in condition) return condition.any.some((item) => evaluate(item, context));
  if ("not" in condition) return !evaluate(condition.not, context);

  const actual = read(context, condition.key);
  const expected = condition.value;
  switch (condition.op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "in":
      return asArray(expected).includes(actual);
    case "notIn":
      return !asArray(expected).includes(actual);
    case "includes":
      return asArray(actual).some((item) => asArray(expected).includes(item));
    case "notIncludes":
      return !asArray(actual).some((item) => asArray(expected).includes(item));
    case "truthy":
      return !isEmpty(actual) && actual !== false;
    case "falsy":
      return isEmpty(actual) || actual === false;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
  }
}

/** Structural check, used when admins save a condition. */
export function isCondition(value: unknown): value is Condition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if ("all" in record) return Array.isArray(record.all) && record.all.every(isCondition);
  if ("any" in record) return Array.isArray(record.any) && record.any.every(isCondition);
  if ("not" in record) return isCondition(record.not);
  return typeof record.key === "string" && record.key.length > 0 && OPERATORS.includes(record.op as Operator);
}
