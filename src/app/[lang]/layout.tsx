import type { Metadata } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import { getDictionary, getLocale } from "@/i18n";
import { localeTags, locales } from "@/i18n/config";
import "../globals.css";

// Nunito: rounded and friendly; has Latin, Czech (latin-ext) and Cyrillic.
const appSans = Nunito({
  variable: "--font-app-sans",
  // latin-ext covers Czech diacritics, cyrillic covers Ukrainian.
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();
  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description,
    icons: { icon: "/favicon.ico" },
    alternates: {
      languages: Object.fromEntries(
        locales.map((locale) => [localeTags[locale], `/${locale}`]),
      ),
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  return (
    <html
      lang={localeTags[locale]}
      className={`${appSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
