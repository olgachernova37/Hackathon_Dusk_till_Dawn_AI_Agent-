import Dashboard from "@/components/Dashboard";
import { I18nProvider } from "@/i18n/client";
import { getDictionary, getLocale } from "@/i18n";

/**
 * Server shell for the console: it resolves the locale once and hands the
 * active dictionary to the client tree, so the browser never downloads the
 * languages this visitor did not pick.
 */
export default async function DashboardPage() {
  const locale = await getLocale();
  const dictionary = await getDictionary();
  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <Dashboard />
    </I18nProvider>
  );
}
