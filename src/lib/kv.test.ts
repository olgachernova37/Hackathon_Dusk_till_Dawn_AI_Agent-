import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Isolated directory, set before the store is first used (kv() is lazy).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kv-test-"));
process.env.KV_DIR = dir;
const { kv, kvBackend } = await import("./kv.ts");

test("uses the file backend when no Redis is configured", () => {
  assert.equal(kvBackend(), "file");
});

test("set then get round-trips a value; a missing key is undefined", async () => {
  await kv().set("a", { n: 1 });
  assert.deepEqual(await kv().get("a"), { n: 1 });
  assert.equal(await kv().get("missing"), undefined);
});

test("setIfAbsent wins exactly once", async () => {
  assert.equal(await kv().setIfAbsent("claim", 1), true);
  assert.equal(await kv().setIfAbsent("claim", 2), false);
  assert.equal(await kv().get("claim"), 1);
});

test("an expired record reads as absent and can be claimed again", async () => {
  await kv().set("short", "v", { ttlSeconds: 1 });
  const file = path.join(dir, `${encodeURIComponent("short")}.json`);
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...record, expiresAt: Date.now() - 1 }));
  assert.equal(await kv().get("short"), undefined);
  assert.equal(await kv().setIfAbsent("short", "again"), true);
});

test("a corrupt record is treated as absent, never a crash", async () => {
  fs.writeFileSync(path.join(dir, `${encodeURIComponent("broken")}.json`), "not-json");
  assert.equal(await kv().get("broken"), undefined);
});

test("keys with separators map to distinct files", async () => {
  await kv().set("receipt:0xabc", "r");
  await kv().set("action:0xabc", "a");
  assert.equal(await kv().get("receipt:0xabc"), "r");
  assert.equal(await kv().get("action:0xabc"), "a");
});
