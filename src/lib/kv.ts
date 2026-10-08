import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

/**
 * Shared key-value store for all server state: pending actions, receipts,
 * replay claims, the continuity ledger and the run log.
 *
 * Backends:
 *   - Redis (Upstash) when configured. Required on Vercel: its filesystem is
 *     read-only, and consecutive requests can land on different instances, so
 *     state written by one request must be visible to the next.
 *   - Local files otherwise (Codespaces dev, `node --test`). One file per key,
 *     so parallel test processes never clobber each other's writes.
 *
 * `setIfAbsent` is atomic in both backends (Redis SET NX; an exclusive-create
 * `wx` open locally). Replay protection relies on this: two concurrent
 * executions of one action cannot both claim it.
 */
export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<void>;
  /** Writes only if the key is absent. Resolves true if this call wrote it. */
  setIfAbsent<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<boolean>;
  /** Appends to an ordered log (run history). */
  append(key: string, value: unknown): Promise<void>;
}

/**
 * Finds Upstash REST credentials under whatever names they were injected.
 * Vercel's Upstash integration lets the user choose a custom variable prefix
 * (its default is "STORAGE", giving e.g. STORAGE_REST_API_URL), so the standard
 * names are tried first and then any <PREFIX>_REST_API_URL / _TOKEN pair.
 */
function redisCredentials(): { url: string; token: string } | undefined {
  const env = process.env;
  for (const [urlKey, tokenKey] of [
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
  ]) {
    if (env[urlKey] && env[tokenKey]) return { url: env[urlKey], token: env[tokenKey] };
  }
  for (const urlKey of Object.keys(env).sort()) {
    if (!urlKey.endsWith("_REST_API_URL")) continue;
    const token = env[urlKey.replace(/_REST_API_URL$/, "_REST_API_TOKEN")];
    const url = env[urlKey];
    if (url && token) return { url, token };
  }
  return undefined;
}

const redisConfigured = Boolean(redisCredentials());

// ------------------------------------------------------------------- redis

function redisKV(): KV {
  const redis = new Redis(redisCredentials()!);
  return {
    async get<T>(key: string) {
      const value = await redis.get<T>(key);
      return value ?? undefined;
    },
    async set(key, value, options) {
      if (options?.ttlSeconds) await redis.set(key, value, { ex: options.ttlSeconds });
      else await redis.set(key, value);
    },
    async setIfAbsent(key, value, options) {
      const result = options?.ttlSeconds
        ? await redis.set(key, value, { nx: true, ex: options.ttlSeconds })
        : await redis.set(key, value, { nx: true });
      return result === "OK";
    },
    async append(key, value) {
      await redis.rpush(key, JSON.stringify(value));
    },
  };
}

// -------------------------------------------------------------------- file

type FileRecord<T> = { value: T; expiresAt?: number };

function fileKV(dir: string): KV {
  const fileFor = (key: string, extension = "json") => path.join(dir, `${encodeURIComponent(key)}.${extension}`);
  const expiry = (ttlSeconds?: number) => (ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined);

  function read<T>(key: string): T | undefined {
    let raw: string;
    try {
      raw = fs.readFileSync(fileFor(key), "utf8");
    } catch {
      return undefined; // absent
    }
    try {
      const record = JSON.parse(raw) as FileRecord<T>;
      if (record.expiresAt && record.expiresAt <= Date.now()) return undefined;
      return record.value;
    } catch {
      console.warn(`[kv] corrupt record for "${key}"; treating it as absent`);
      return undefined;
    }
  }

  return {
    async get<T>(key: string) {
      return read<T>(key);
    },
    async set(key, value, options) {
      fs.mkdirSync(dir, { recursive: true });
      const target = fileFor(key);
      const temporary = `${target}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify({ value, expiresAt: expiry(options?.ttlSeconds) }));
      fs.renameSync(temporary, target); // atomic replace
    },
    async setIfAbsent(key, value, options) {
      fs.mkdirSync(dir, { recursive: true });
      const target = fileFor(key);
      // An expired record counts as absent: clear it before the exclusive create.
      if (fs.existsSync(target) && read(key) === undefined) fs.rmSync(target, { force: true });
      try {
        fs.writeFileSync(target, JSON.stringify({ value, expiresAt: expiry(options?.ttlSeconds) }), { flag: "wx" });
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
        throw error;
      }
    },
    async append(key, value) {
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(fileFor(key, "jsonl"), `${JSON.stringify(value)}\n`);
    },
  };
}

// ------------------------------------------------------------------ select

function select(): KV {
  if (redisConfigured) return redisKV();
  if (process.env.VERCEL) {
    // Fail with the actual cause, instead of an EROFS crash on the first write.
    throw new Error(
      "No Redis configured on Vercel. Connect the Upstash for Redis integration to this project " +
        "(any variable prefix works: <PREFIX>_REST_API_URL + <PREFIX>_REST_API_TOKEN), then redeploy. " +
        "The local file store cannot run on Vercel.",
    );
  }
  return fileKV(process.env.KV_DIR ?? path.join(process.cwd(), ".data", "kv"));
}

let instance: KV | undefined;

/** Lazily selected, so importing this module never throws at build time. */
export function kv(): KV {
  instance ??= select();
  return instance;
}

export const kvBackend = (): "redis" | "file" => (redisConfigured ? "redis" : "file");

/** 30 days: long enough for the demo, judging, and the audit trail. */
export const RETENTION_SECONDS = 30 * 24 * 60 * 60;
