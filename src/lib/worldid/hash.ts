import { keccak256, toHex } from "viem";

function canonicalize(value: unknown, path: string): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value) || Object.is(value, -0)) {
        throw new TypeError(`Cannot canonicalize ambiguous number at ${path}`);
      }
      return JSON.stringify(value);
    case "undefined":
      throw new TypeError(`Cannot canonicalize undefined at ${path}`);
    case "bigint":
      throw new TypeError(`Cannot canonicalize BigInt at ${path}`);
    case "function":
      throw new TypeError(`Cannot canonicalize function at ${path}`);
    case "symbol":
      throw new TypeError(`Cannot canonicalize symbol at ${path}`);
    case "object":
      break;
    default:
      throw new TypeError(`Cannot canonicalize value at ${path}`);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${path}[${index}]`)).join(",")}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`Cannot canonicalize non-plain object at ${path}`);
  }

  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    throw new TypeError(`Cannot canonicalize symbol key at ${path}`);
  }

  const entries = Object.keys(value).sort().map((key) => {
    return `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key], `${path}.${key}`)}`;
  });
  return `{${entries.join(",")}}`;
}

/** Stable JSON for action hashing: object keys sort, array order remains meaningful. */
export function canonicalJson(value: unknown): string {
  return canonicalize(value, "$ ".trim());
}

/** World ID signal: keccak256 of the exact canonical action payload. */
export function hashAction(payload: Record<string, unknown>): string {
  return keccak256(toHex(canonicalJson(payload)));
}