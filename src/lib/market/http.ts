import { MarketError } from "./deals.ts";

/** Shared helpers for the /api/market route handlers. */

export function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function handleError(error: unknown): Response {
  if (error instanceof MarketError) return errorResponse(error.code, error.message, error.status);
  console.error("[market]", error);
  return errorResponse("INTERNAL", error instanceof Error ? error.message : "Unexpected error", 500);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new MarketError("INVALID_JSON", "Request body must be JSON", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new MarketError("INVALID_REQUEST", "Request body must be a JSON object", 400);
  return body as Record<string, unknown>;
}

export function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) throw new MarketError("INVALID_REQUEST", `${field} is required`, 400);
  return value;
}

export function optionalNumber(body: Record<string, unknown>, field: string): number | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new MarketError("INVALID_REQUEST", `${field} must be a number`, 400);
  return number;
}

/** Dashboard deep link where a human approves with Selfie Check. */
export function approvalUrl(request: Request, actionId: string): string {
  const baseUrl = process.env.PUBLIC_BASE_URL || new URL(request.url).origin;
  return `${baseUrl.replace(/\/$/, "")}/dashboard?action=${encodeURIComponent(actionId)}`;
}
