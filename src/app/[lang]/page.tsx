import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Inter, Instrument_Serif } from "next/font/google";
import LandingHeader from "@/components/LandingHeader";
import LandingMotion from "@/components/LandingMotion";
import { getDictionary, getLocale } from "@/i18n";
import styles from "./landing.module.css";

const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-landing-sans", display: "swap" });
// Instrument Serif has no Cyrillic; Ukrainian falls back per glyph to Georgia/Times.
const serif = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin", "latin-ext"], variable: "--font-landing-serif", display: "swap" });

// Self-hosted H.264 transcode of the original hero clip. The original was HEVC
// 10-bit with its moov atom at the end: it would not play in Firefox or in
// Chromium builds without HEVC, and mobile had to fetch the file's tail before
// starting. This copy is 3.5 MB (was 9.0 MB), faststart, same 1080p/24fps.
const HERO_VIDEO =
  "/hero.mp4";
const SOURCE_URL = "https://github.com/olgachernova37/Matching";

/** Entrance delay, read by the `.appear*` classes as `var(--d)`. */
const delay = (value: string) => ({ "--d": value }) as CSSProperties;

export default async function Home() {
  const locale = await getLocale();
  const t = await getDictionary();
  const copy = t.landing;

  return (
    <div className={`${styles.root} ${inter.variable} ${serif.variable}`}>
      <div className={styles.grain} aria-hidden="true" />
      <video
        className={styles.heroVideo}
        data-hero-video
        src={HERO_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />

      <div className={styles.page}>
        <LandingHeader
          locale={locale}
          strings={{
            brand: copy.brand,
            brandSuffix: copy.brandSuffix,
            homeAria: copy.homeAria,
            navLabel: copy.navLabel,
            nav: copy.nav,
            openConsole: copy.openConsole,
            menuOpen: copy.menuOpen,
            menuClose: copy.menuClose,
            languageLabel: t.language.label,
            switchTo: t.language.switchTo,
          }}
        />

        <main className={styles.hero} id="top">
          {/* Shown by LandingMotion only when the background video cannot play in this browser. */}
          <div className={styles.heroMark} aria-hidden="true">
            <Image src="/infinity-mark.svg" alt="" width={720} height={420} className={styles.heroMarkImg} />
          </div>
          <div className={styles.heroCopy}>
            <p className={`${styles.badge} ${styles.appear} ${styles.appearPop}`} data-appear style={delay("0.22s")}>
              <svg className={styles.badgeStar} width="18" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#ffffff"
                  d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z"
                />
              </svg>
              {copy.badge}
            </p>

            <h1 className={styles.headline}>
              <span className={styles.headlineLine}>
                <span className={`${styles.headlineInner} ${styles.appear} ${styles.appearMask}`} data-appear style={delay("0.42s")}>
                  {copy.headline.before} <em>{copy.headline.em}</em> {copy.headline.after}
                </span>
              </span>
              <span className={styles.headlineLine}>
                <span className={`${styles.headlineInner} ${styles.appear} ${styles.appearMask}`} data-appear style={delay("0.62s")}>
                  {copy.headline.bottom}
                </span>
              </span>
            </h1>

            <p className={`${styles.lede} ${styles.appear} ${styles.appearSoft}`} data-appear style={delay("0.82s")}>
              {copy.lead}
            </p>

            <div className={styles.heroActions}>
              <Link
                href={`/${locale}/dashboard`}
                className={`${styles.btn} ${styles.btnSolid} ${styles.appear} ${styles.appearBtn}`}
                data-appear
                style={delay("0.96s")}
              >
                {copy.openConsole}
              </Link>
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.btn} ${styles.btnGhost} ${styles.appear} ${styles.appearSide}`}
                data-appear
                style={delay("1.10s")}
              >
                {copy.viewSource}
              </a>
            </div>

            {/* Animation on the <p>, gold on the <span>: `data-in` resets filter, which would kill the glow. */}
            <p className={`${styles.credit} ${styles.appearSoft}`} data-appear style={delay("1.18s")}>
              <span className="text-gold">{copy.credit}</span>
            </p>
          </div>
        </main>

        {/* Gold infinity mark, always visible in the bottom-right corner. */}
        <div className={styles.cornerMark} aria-hidden="true">
          <Image src="/infinity-mark.svg" alt="" width={720} height={420} className={styles.cornerMarkImg} />
        </div>

        <footer className={styles.stats} aria-label={copy.statsLabel}>
          <div className={`${styles.stat} ${styles.appear} ${styles.appearStat}`} data-appear style={delay("1.12s")}>
            <svg className={styles.statIcon} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <defs>
                <linearGradient id="hg-pill-a" x1="3" y1="2" x2="14" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0.38" stopColor="#ffffff" />
                  <stop offset="0.62" stopColor="#3a3a3a" />
                </linearGradient>
                <linearGradient id="hg-pill-b" x1="3" y1="2" x2="14" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0.38" stopColor="#3a3a3a" />
                  <stop offset="0.62" stopColor="#ffffff" />
                </linearGradient>
              </defs>
              <rect x="3.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="url(#hg-pill-a)" />
              <rect x="13.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="url(#hg-pill-b)" />
              <rect x="9.2" y="10.9" width="5.6" height="2.2" rx="1.1" fill="#4a4a4a" />
            </svg>
            <span>{copy.stats.binding}</span>
          </div>

          <div className={`${styles.stat} ${styles.appear} ${styles.appearStat}`} data-appear style={delay("1.28s")}>
            <svg className={styles.statIcon} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="6.2" fill="#ffffff" />
              <path d="M7.9 12.3l2.75 2.75L16.1 9.4" fill="none" stroke="#111" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{copy.stats.receipt}</span>
          </div>

          <div className={`${styles.stat} ${styles.appear} ${styles.appearStat}`} data-appear style={delay("1.44s")}>
            <svg className={styles.statIconWide} width="38" height="21" viewBox="0 0 40 22" aria-hidden="true">
              <circle cx="10.2" cy="11" r="9.2" fill="#2b2b2b" />
              <text x="10.2" y="14.6" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff">G</text>
              <circle cx="20.2" cy="11" r="9.2" fill="#ffffff" />
              <text x="20.2" y="14.6" textAnchor="middle" fontSize="10" fontWeight="700" fill="#000000">W</text>
              <circle cx="30.2" cy="11" r="9.2" fill="#7ab8f5" />
              <text x="30.2" y="14.6" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0d0e10">B</text>
            </svg>
            <span>{copy.stats.sponsors}</span>
          </div>
        </footer>
      </div>

      <LandingMotion />
    </div>
  );
}
