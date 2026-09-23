import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import es from "../../messages/es.json";
import en from "../../messages/en.json";
import pt from "../../messages/pt.json";
import { routing } from "./routing";

const messagesByLocale = { es, en, pt } as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
