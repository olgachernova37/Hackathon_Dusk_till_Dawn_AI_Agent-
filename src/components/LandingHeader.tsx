"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import styles from "@/app/[lang]/landing.module.css";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { Locale } from "@/i18n/config";

export type LandingHeaderStrings = {
  brand: string;
  brandSuffix: string;
  homeAria: string;
  navLabel: string;
  nav: { howItWorks: string; sponsors: string; security: string; gatewayApi: string };
  openConsole: string;
  menuOpen: string;
  menuClose: string;
  languageLabel: string;
  switchTo: string;
};

const REPO = "https://github.com/olgachernova37/Matching";

const NAV_LINKS = [
  { key: "howItWorks", href: `${REPO}#the-idea-bind-the-proof-to-the-action-not-the-session`, appear: "appearScale", delay: "0.16s" },
  { key: "sponsors", href: `${REPO}#how-each-sponsor-is-load-bearing`, appear: "appearSoft", delay: "0.28s" },
  { key: "security", href: `${REPO}#security-properties-each-with-a-test`, appear: "appearScale", delay: "0.40s" },
  { key: "gatewayApi", href: `${REPO}#try-the-gateway-as-an-agent-would`, appear: "appearSoft", delay: "0.52s" },
] as const;

/** Entrance delay, read by the `.appear*` classes as `var(--d)`. */
const delay = (value: string) => ({ "--d": value }) as CSSProperties;

export default function LandingHeader({ locale, strings }: { locale: Locale; strings: LandingHeaderStrings }) {
  const [open, setOpen] = useState(false);
  const menuState = open ? "true" : "false";

  // Freeze the page behind the open phone menu.
  useEffect(() => {
    document.body.classList.toggle("landing-menu-open", open);
    return () => document.body.classList.remove("landing-menu-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // The menu only exists on phones; growing past the breakpoint closes it.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 901px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  const switcher = <LanguageSwitcher locale={locale} label={strings.languageLabel} switchTo={strings.switchTo} />;

  return (
    <>
      <div className={styles.menuBackdrop} data-menu-open={menuState} aria-hidden="true" />
      <header className={styles.header} data-menu-open={menuState}>
        <Link
          href={`/${locale}`}
          aria-label={strings.homeAria}
          className={`${styles.logo} ${styles.appear} ${styles.appearScale}`}
          data-appear
          style={delay("0.08s")}
        >
          <svg
            className={styles.logoMark}
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 12C10.15 10.19 8.14 8.47 5.9 8.47C3.59 8.47 2 9.92 2 12C2 14.08 3.59 15.53 5.9 15.53C8.14 15.53 10.15 13.82 12 12ZM12 12C13.85 10.19 15.86 8.47 18.1 8.47C20.41 8.47 22 9.92 22 12C22 14.08 20.41 15.53 18.1 15.53C15.86 15.53 13.85 13.82 12 12Z" />
          </svg>
          <span>
            {strings.brand}
            <span className={styles.logoSuffix}>{strings.brandSuffix}</span>
          </span>
        </Link>

        <nav id="site-nav" className={styles.nav} aria-label={strings.navLabel}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.key}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.navLink} ${styles.appear} ${styles[link.appear]}`}
              data-appear
              style={delay(link.delay)}
              onClick={() => setOpen(false)}
            >
              {strings.nav[link.key]}
            </a>
          ))}
          <div className={`${styles.switcher} ${styles.menuSwitcher}`} onClick={() => setOpen(false)}>
            {switcher}
          </div>
        </nav>

        <div className={styles.headerEnd}>
          <div
            className={`${styles.switcher} ${styles.headerSwitch} ${styles.appear} ${styles.appearScale}`}
            data-appear
            style={delay("0.34s")}
          >
            {switcher}
          </div>
          <Link
            href={`/${locale}/dashboard`}
            className={`${styles.btn} ${styles.btnSolid} ${styles.headerCta} ${styles.appear} ${styles.appearScale}`}
            data-appear
            style={delay("0.34s")}
          >
            {strings.openConsole}
          </Link>
        </div>

        <button
          type="button"
          className={`${styles.burger} ${styles.appear} ${styles.appearScale}`}
          data-appear
          style={delay("0.34s")}
          aria-controls="site-nav"
          aria-expanded={open}
          aria-label={open ? strings.menuClose : strings.menuOpen}
          onClick={() => setOpen((value) => !value)}
        >
          <span className={styles.burgerBar} />
          <span className={styles.burgerBar} />
          <span className={styles.burgerBar} />
        </button>
      </header>
    </>
  );
}
