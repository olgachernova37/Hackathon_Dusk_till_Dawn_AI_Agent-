import MarketConsole from "@/components/MarketConsole";
import { I18nProvider } from "@/i18n/client";
import { getDictionary, getLocale } from "@/i18n";

/** Server shell for the marketplace deal console, mirroring the dashboard page. */
export default async function MarketPage() {
  const locale = await getLocale();
  const dictionary = await getDictionary();
  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <MarketConsole />
    </I18nProvider>
  );
}
