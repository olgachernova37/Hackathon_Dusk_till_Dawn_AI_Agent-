import assert from "node:assert/strict";
import test from "node:test";
import { locales } from "./config.ts";
import { fill, formatUsd, plural } from "./format.ts";
import { en } from "./dictionaries/en.ts";
import { cs } from "./dictionaries/cs.ts";
import { uk } from "./dictionaries/uk.ts";

const dictionaries = { en, cs, uk };

test("Czech picks one / few / other, not just singular and plural", () => {
  // Czech counts 1, then 2-4, then 5 and up — a naive singular/plural split
  // would render "5 kroky" and read as broken Czech.
  assert.equal(plural("cs", cs.trail.steps, 1), "1 krok");
  assert.equal(plural("cs", cs.trail.steps, 2), "2 kroky");
  assert.equal(plural("cs", cs.trail.steps, 4), "4 kroky");
  assert.equal(plural("cs", cs.trail.steps, 5), "5 kroků");
  assert.equal(plural("cs", cs.trail.steps, 11), "11 kroků");
});

test("Ukrainian picks one / few / many, including the teens exception", () => {
  // 21 is "one" and 22 is "few", but 11-14 stay "many" — the rule keys off the
  // last two digits, so testing only 1-5 would hide the bug.
  assert.equal(plural("uk", uk.trail.steps, 1), "1 крок");
  assert.equal(plural("uk", uk.trail.steps, 3), "3 кроки");
  assert.equal(plural("uk", uk.trail.steps, 5), "5 кроків");
  assert.equal(plural("uk", uk.trail.steps, 11), "11 кроків");
  assert.equal(plural("uk", uk.trail.steps, 21), "21 крок");
  assert.equal(plural("uk", uk.trail.steps, 22), "22 кроки");
});

test("English still reads correctly for the singular case", () => {
  assert.equal(plural("en", en.trail.steps, 1), "1 step");
  assert.equal(plural("en", en.trail.steps, 2), "2 steps");
});

test("the continuity line agrees with each language's day forms", () => {
  assert.match(plural("cs", cs.trail.returningHuman, 1), /před 1 dnem$/);
  assert.match(plural("cs", cs.trail.returningHuman, 3), /před 3 dny$/);
  assert.match(plural("uk", uk.trail.returningHuman, 1), /1 день тому$/);
  assert.match(plural("uk", uk.trail.returningHuman, 2), /2 дні тому$/);
  assert.match(plural("uk", uk.trail.returningHuman, 7), /7 днів тому$/);
  assert.match(plural("en", en.trail.returningHuman, 1), /1 day ago$/);
  assert.match(plural("en", en.trail.returningHuman, 7), /7 days ago$/);
});

test("every plural form falls back to `other` rather than rendering blank", () => {
  // Locale data may hand us a category a dictionary chose not to spell out.
  for (const locale of locales) {
    for (const n of [0, 1, 2, 5, 21, 100]) {
      const rendered = plural(locale, dictionaries[locale].trail.steps, n);
      assert.ok(rendered.includes(String(n)), `${locale} lost the count at n=${n}`);
      assert.ok(!rendered.includes("{n}"), `${locale} left a placeholder at n=${n}`);
    }
  }
});

test("fill substitutes named placeholders and leaves unknown ones alone", () => {
  assert.equal(fill(uk.evidence.riskAria, { score: 72 }), "Оцінка ризику 72 зі 100");
  assert.equal(fill(cs.language.switchTo, { name: "Українська" }), "Přepnout jazyk na Українська");
  assert.equal(fill("{a} and {b}", { a: "x" }), "x and {b}");
});

test("amounts group digits per locale, so Czech and Ukrainian do not read as English", () => {
  assert.equal(formatUsd("en", 1234.5), "$1,234.5");
  // cs and uk group with a space and use a comma decimal separator.
  assert.notEqual(formatUsd("cs", 1234.5), formatUsd("en", 1234.5));
  assert.match(formatUsd("cs", 1234.5), /1\s?234,5/);
  assert.match(formatUsd("uk", 1234.5), /1\s?234,5/);
});

test("every locale defines every key the reference dictionary has", () => {
  // The `Dictionary` type already enforces this at compile time; this catches
  // an empty string slipping through, which the type cannot see.
  //
  // Plural objects are treated as leaves: English has only one/other while
  // Czech and Ukrainian need up to four categories, so their key sets are
  // *supposed* to differ. `plural()` covers the categories themselves.
  const categories = new Set(["zero", "one", "two", "few", "many", "other"]);
  const isPlural = (value: object) =>
    "other" in value && Object.keys(value).every((key) => categories.has(key));

  const walk = (value: unknown, trail: string[] = []): string[] =>
    typeof value === "object" && value !== null && !isPlural(value)
      ? Object.entries(value).flatMap(([key, child]) => walk(child, [...trail, key]))
      : [trail.join(".")];

  const reference = walk(en).sort();
  for (const locale of locales) {
    assert.deepEqual(walk(dictionaries[locale]).sort(), reference, `${locale} has a different key set`);
  }
});

test("no locale ships an empty string where the reference has text", () => {
  const blanks = (value: unknown, trail: string[] = []): string[] =>
    typeof value === "object" && value !== null
      ? Object.entries(value).flatMap(([key, child]) => blanks(child, [...trail, key]))
      : typeof value === "string" && value.trim() === ""
        ? [trail.join(".")]
        : [];

  for (const locale of locales) {
    assert.deepEqual(blanks(dictionaries[locale]), [], `${locale} has an empty string`);
  }
});
