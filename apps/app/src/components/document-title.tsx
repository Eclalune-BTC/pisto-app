import Head from "expo-router/head";
import { useTranslation } from "react-i18next";

/** Names the browser tab and history entry after the page; a no-op outside the web. */
export function DocumentTitle({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <Head>
      <title>{t("common.documentTitle", { page: title })}</title>
    </Head>
  );
}
