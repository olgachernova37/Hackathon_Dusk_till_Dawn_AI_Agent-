import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, hashAction } from "./hash.ts";

test("canonicalizes object keys independent of insertion order", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(hashAction({ b: 2, a: 1 }), hashAction({ a: 1, b: 2 }));
  assert.equal(hashAction({ value: "a b" }), hashAction({ value: "a b" }));
});

test("preserves nested objects and array order", () => {
  assert.equal(canonicalJson({ z: [{ b: true, a: null }] }), '{"z":[{"a":null,"b":true}]}');
  assert.notEqual(hashAction({ values: [1, 2] }), hashAction({ values: [2, 1] }));
});

test("rejects ambiguous values instead of coercing them", () => {
  const values = [undefined, Number.NaN, Number.POSITIVE_INFINITY, -0, () => undefined, Symbol("x"), BigInt(1)];
  for (const value of values) {
    assert.throws(() => canonicalJson(value), TypeError);
  }
  assert.throws(() => canonicalJson({ value: undefined }), /undefined/);
});