import { localeTags, type Locale } from "./config.ts";

/**
 * Plural forms as CLDR categories. Only `other` is mandatory; every locale
 * falls back to it for the categories it does not use.
 */
export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** Replaces `{name}` placeholders. Dictionaries stay plain data so a Server
 *  Component can hand one to a Client Component as a prop. */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** Picks the plural form Czech and Ukrainian actually need (one / few / many). */
export function plural(locale: Locale, forms: Plural, n: number): string {
  const rule = new Intl.PluralRules(localeTags[locale]).select(n);
  return fill(forms[rule] ?? forms.other, { n });
}

export const formatUsd = (locale: Locale, amount: number) =>
  `$${amount.toLocaleString(localeTags[locale], { maximumFractionDigits: 2 })}`;

export const formatDate = (locale: Locale, value: number) =>
  new Date(value).toLocaleDateString(localeTags[locale]);

export const formatTime = (locale: Locale, value: number) =>
  new Date(value).toLocaleTimeString(localeTags[locale]);
