"use client";

import { createContext, useContext, useMemo } from "react";
import { defaultLocale, type Locale } from "./config.ts";
import { fill, formatDate, formatTime, formatUsd, plural, type Plural } from "./format.ts";
import type { Dictionary } from "./dictionaries/en.ts";

type I18n = {
  locale: Locale;
  t: Dictionary;
  /** `t.evidence.secondsAgo` and friends carry `{name}` placeholders. */
  fill: (template: string, vars?: Record<string, string | number>) => string;
  /** Czech and Ukrainian need one/few/many, not just singular/plural. */
  plural: (forms: Plural, n: number) => string;
  usd: (amount: number) => string;
  date: (value: number) => string;
  time: (value: number) => string;
};

const I18nContext = createContext<I18n | null>(null);

/**
 * The active dictionary is handed down from the server page as a plain object
 * — that is why dictionaries hold no functions — so the client bundle never
 * carries the languages the visitor did not ask for.
 */
export function I18nProvider({ locale, dictionary, children }: { locale: Locale; dictionary: Dictionary; children: React.ReactNode }) {
  const value = useMemo<I18n>(
    () => ({
      locale,
      t: dictionary,
      fill,
      plural: (forms, n) => plural(locale, forms, n),
      usd: (amount) => formatUsd(locale, amount),
      date: (value) => formatDate(locale, value),
      time: (value) => formatTime(locale, value),
    }),
    [locale, dictionary],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>");
  return context;
}

export { defaultLocale };
