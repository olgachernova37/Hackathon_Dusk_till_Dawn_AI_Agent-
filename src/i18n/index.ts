import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "./config.ts";
import { en, type Dictionary } from "./dictionaries/en.ts";
import { cs } from "./dictionaries/cs.ts";
import { uk } from "./dictionaries/uk.ts";

export const dictionaries: Record<Locale, Dictionary> = { en, cs, uk };

export function getDictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

/**
 * Server-side dictionary lookup. `lang` is a root param (every route lives
 * under `app/[lang]`), so no page has to drill the locale down as a prop.
 * Only callable from Server Components — see next/root-params.
 */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!value || !isLocale(value)) notFound();
  return value;
}

export async function getDictionary(): Promise<Dictionary> {
  return getDictionaryFor(await getLocale());
}

export type { Dictionary };
