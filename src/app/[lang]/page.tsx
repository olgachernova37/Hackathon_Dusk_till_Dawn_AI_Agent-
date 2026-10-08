import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getDictionary, getLocale } from "@/i18n";

const SOURCE_URL = "https://github.com/olgachernova37/Hackathon_Dusk_till_Dawn_AI_Agent-";

/** A calm sun with closed eyes — the page's only illustration. */
function Sun() {
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
      <circle cx="56" cy="56" r="52" fill="var(--sun)" />
      <path d="M36 54c3 5 10 5 13 0M63 54c3 5 10 5 13 0" fill="none" stroke="#1f2330" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M46 70c6 6 14 6 20 0" fill="none" stroke="#1f2330" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function Choice({ href, title, text, cta, tone }: { href: string; title: string; text: string; cta: string; tone: "sun" | "brand" }) {
  const top = tone === "sun" ? "bg-sun/15" : "bg-brand/10";
  const button = tone === "sun" ? "bg-sun text-foreground" : "bg-brand text-white";
  return (
    <Link href={href} className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`px-6 pb-5 pt-6 ${top}`}>
        <h2 className="text-2xl font-extrabold">{title}</h2>
      </div>
      <div className="flex flex-1 flex-col px-6 pb-6 pt-4">
        <p className="flex-1 text-base leading-7 text-muted">{text}</p>
        <span className={`mt-6 rounded-full px-6 py-3 text-center text-base font-bold ${button} group-hover:opacity-90`}>{cta}</span>
      </div>
    </Link>
  );
}

export default async function Home() {
  const locale = await getLocale();
  const t = await getDictionary();
  const home = t.landing.home;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <span className="text-lg font-extrabold">{t.landing.brand}{t.landing.brandSuffix}</span>
        <LanguageSwitcher locale={locale} label={t.language.label} switchTo={t.language.switchTo} />
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-16 pt-6 text-center">
        <div className="flex justify-center"><Sun /></div>
        <h1 className="mx-auto mt-6 max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">{home.title}</h1>
        <p className="mt-3 text-lg text-muted">{home.lead}</p>

        <div className="mt-10 grid gap-5 text-left sm:grid-cols-2">
          <Choice href={`/${locale}/dashboard`} title={home.copilot.title} text={home.copilot.text} cta={home.copilot.cta} tone="sun" />
          <Choice href={`/${locale}/market`} title={home.market.title} text={home.market.text} cta={home.market.cta} tone="brand" />
        </div>

        <p className="mt-12 text-sm text-muted">
          {t.landing.credit} · <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">{home.source}</a>
        </p>
      </main>
    </div>
  );
}
