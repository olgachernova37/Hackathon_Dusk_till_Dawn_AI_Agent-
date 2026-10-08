"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { localeNames, locales, type Locale } from "@/i18n/config";
import { fill } from "@/i18n/format";

type LanguageSwitcherProps = { locale: Locale; label: string; switchTo: string };

/**
 * Swaps the `[lang]` segment of the current URL and keeps the rest of the path.
 *
 * Deliberately avoids `useSearchParams`: that hook opts the whole subtree out
 * of static rendering, which would keep these links out of the prerendered
 * landing page. The query string is instead read at click time, so the
 * dashboard's `?action=` deep link still survives a language change.
 */
export default function LanguageSwitcher({ locale, label, switchTo }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();

  function hrefFor(target: Locale): string {
    const segments = pathname.split("/");
    // segments[0] is the empty string before the leading slash.
    segments[1] = target;
    return segments.join("/");
  }

  return (
    <nav aria-label={label} className="flex items-center gap-1 font-mono text-xs uppercase tracking-[0.12em]">
      {locales.map((option, index) => {
        const href = hrefFor(option);
        return (
          <span key={option} className="flex items-center gap-1">
            {index > 0 && <span aria-hidden="true" className="text-border">/</span>}
            <Link
              href={href}
              hrefLang={option}
              aria-current={option === locale ? "true" : undefined}
              aria-label={fill(switchTo, { name: localeNames[option] })}
              title={localeNames[option]}
              onClick={(event) => {
                const search = window.location.search;
                if (!search) return;
                event.preventDefault();
                router.push(`${href}${search}`);
              }}
              className={
                option === locale
                  ? "rounded px-1.5 py-1 text-brand"
                  : "rounded px-1.5 py-1 text-muted transition-colors hover:text-foreground"
              }
            >
              {option}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
