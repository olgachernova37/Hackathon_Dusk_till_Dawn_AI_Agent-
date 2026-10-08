/**
 * Locale registry — the single source of truth for i18n.
 *
 * `proxy.ts` (locale negotiation), the `[lang]` route segment and the language
 * switcher all read from here, so adding a language means adding it in this
 * list plus one dictionary file under `dictionaries/`.
 */

export const locales = ["en", "cs", "uk"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Endonyms — a language is always offered in its own words, never translated. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  cs: "Čeština",
  uk: "Українська",
};

/** BCP 47 tags for `<html lang>`, `hreflang` and `Intl.*` formatting. */
export const localeTags: Record<Locale, string> = {
  en: "en",
  cs: "cs-CZ",
  uk: "uk-UA",
};

export const cookieName = "NEXT_LOCALE";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
