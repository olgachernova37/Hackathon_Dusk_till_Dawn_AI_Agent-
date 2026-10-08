import { z } from "zod";

/**
 * Environment access — see PLAN.md T1.
 *
 * Split deliberately:
 *   - clientEnv  : NEXT_PUBLIC_* only, safe in browser bundles.
 *   - serverEnv(): secrets. Lazy, so importing this module from a client
 *                  component never throws on a missing server secret.
 *
 * Next inlines `process.env.NEXT_PUBLIC_X` only when written as a literal
 * member expression, so the client keys below must stay spelled out.
 */

const required = (name: string) =>
  z.string().min(1, `Missing required env var: ${name}`);

// ------------------------------------------------------------------ client

const clientSchema = z.object({
  NEXT_PUBLIC_WLD_APP_ID: required("NEXT_PUBLIC_WLD_APP_ID"),
  NEXT_PUBLIC_WLD_ACTION: required("NEXT_PUBLIC_WLD_ACTION"),
  // All three IDKit environments: "sandbox" = the Sandbox World App,
  // "staging" = World's web simulator (docs: "To test during development, use
  // the simulator and set environment to staging"), "production" = real users.
  NEXT_PUBLIC_WLD_ENV: z.enum(["sandbox", "staging", "production"]).default("sandbox"),
});

const clientParsed = clientSchema.safeParse({
  NEXT_PUBLIC_WLD_APP_ID: process.env.NEXT_PUBLIC_WLD_APP_ID,
  NEXT_PUBLIC_WLD_ACTION: process.env.NEXT_PUBLIC_WLD_ACTION,
  NEXT_PUBLIC_WLD_ENV: process.env.NEXT_PUBLIC_WLD_ENV,
});

if (!clientParsed.success) {
  // Warn rather than throw: T6 must stay able to develop the UI against mocks
  // before World ID credentials land (T0.1 is async).
  console.warn(
    "[env] client env incomplete — World ID widget will not work:\n" +
      clientParsed.error.issues.map((i) => `  - ${i.message}`).join("\n"),
  );
}

export const clientEnv = clientParsed.success
  ? clientParsed.data
  : {
      NEXT_PUBLIC_WLD_APP_ID: "",
      NEXT_PUBLIC_WLD_ACTION: "",
      NEXT_PUBLIC_WLD_ENV: "sandbox" as const,
    };

// ------------------------------------------------------------------ server

const serverSchema = z.object({
  WLD_RP_ID: required("WLD_RP_ID"),
  WLD_RP_PRIVATE_KEY: required("WLD_RP_PRIVATE_KEY"),
  GRAPH_API_KEY: required("GRAPH_API_KEY"),
  BAZANTIC_GATEWAY_URL: z.url("BAZANTIC_GATEWAY_URL must be a valid URL"),
  GEMINI_API_KEY: required("GEMINI_API_KEY"),
  GEMINI_MODEL: z.string().min(1).default("gemini-flash-lite-latest"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Per-key validation, on access.
 *
 * `serverEnv().GRAPH_API_KEY` validates *only* GRAPH_API_KEY. Validating every
 * secret up front meant one missing credential (say, a World ID key still
 * waiting on access approval) broke unrelated features — the planner and the
 * Graph smoke test both failed naming WLD_RP_ID. Each module now fails only
 * for the key it actually needs, still loudly and by name.
 */
export function serverEnv(): ServerEnv {
  return new Proxy({} as ServerEnv, {
    get(_target, key) {
      if (typeof key !== "string" || !(key in serverSchema.shape)) return undefined;
      const field = serverSchema.shape[key as keyof ServerEnv];
      // Trim, and treat an empty value as unset. Hosting dashboards make both
      // easy to get wrong: an empty GEMINI_MODEL on Vercel rejected the whole
      // planner instead of falling back to its default, and a key pasted with
      // a trailing newline would fail authentication with no obvious cause.
      const raw = process.env[key]?.trim();
      const parsed = field.safeParse(raw === "" ? undefined : raw);
      if (!parsed.success) {
        throw new Error(
          `Invalid server environment: ${key} — ${parsed.error.issues[0]?.message ?? "invalid"}. ` +
            "Set it in .env.local locally, or in the hosting dashboard's environment variables (then redeploy).",
        );
      }
      return parsed.data;
    },
  });
}

// ------------------------------------------------------------------- mocks

/**
 * Offline dev switches. MUST be off by default and MUST make the UI show a
 * visible "MOCK DATA" badge — The Graph prize disqualifies mocked data, so a
 * mock path that ships unnoticed costs us the track (PLAN.md T2).
 */
export const mocks = {
  graph: process.env.MOCK_GRAPH === "1",
  worldid: process.env.MOCK_WORLDID === "1",
  bazantic: process.env.MOCK_BAZANTIC === "1",
};

export const anyMockEnabled = Object.values(mocks).some(Boolean);
