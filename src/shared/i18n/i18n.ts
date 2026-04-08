import i18next from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  SUPPORTED_LOCALES,
  type AppLocale,
  type TranslationNamespace,
} from "./constants";
import { getInitialLocale } from "./locale";

function normalizeSupportedLocale(locale?: string | null): AppLocale | null {
  if (!locale) return null;

  try {
    const canonical = Intl.getCanonicalLocales(locale)[0]?.toLowerCase();
    if (!canonical) return null;
    const base = canonical.split("-")[0];
    return SUPPORTED_LOCALES.includes(base as AppLocale)
      ? (base as AppLocale)
      : null;
  } catch {
    return null;
  }
}

const localeResourceLoaders = {
  en: {
    common: () => import("./locales/en/common.json"),
    home: () => import("./locales/en/home.json"),
    settings: () => import("./locales/en/settings.json"),
    sidebar: () => import("./locales/en/sidebar.json"),
    status: () => import("./locales/en/status.json"),
    sessions: () => import("./locales/en/sessions.json"),
  },
  es: {
    common: () => import("./locales/es/common.json"),
    home: () => import("./locales/es/home.json"),
    settings: () => import("./locales/es/settings.json"),
    sidebar: () => import("./locales/es/sidebar.json"),
    status: () => import("./locales/es/status.json"),
    sessions: () => import("./locales/es/sessions.json"),
  },
} as const satisfies Record<
  AppLocale,
  Record<TranslationNamespace, () => Promise<unknown>>
>;

function getNamespaceLoader(language: string, namespace: string) {
  const locale = normalizeSupportedLocale(language) ?? DEFAULT_LOCALE;
  const typedNamespace = namespace as TranslationNamespace;
  return localeResourceLoaders[locale][typedNamespace];
}

export const i18n = i18next.createInstance();

void i18n
  .use(
    resourcesToBackend((language: string, namespace: string) =>
      getNamespaceLoader(language, namespace)(),
    ),
  )
  .use(initReactI18next)
  .init({
    lng: getInitialLocale(),
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: DEFAULT_NAMESPACE,
    fallbackNS: DEFAULT_NAMESPACE,
    ns: [DEFAULT_NAMESPACE],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    returnEmptyString: false,
  });
