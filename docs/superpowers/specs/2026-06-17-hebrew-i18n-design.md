# Hebrew Language Support (i18n + RTL) — Design

> Status: approved design (2026-06-17). Next: implementation plan via writing-plans.

## Goal

Make the entire AffiliateOS UI available in Hebrew (with RTL) and English, with
the language auto-detected from the browser and a toggle the user can flip
(persisted). AI-generated content (verdicts, deep analysis, signals, scorecards,
test kits, diagnoses) stays English for now — only the UI chrome is translated.

## Locked decisions (from brainstorming)

1. **Scope: everything** — `(app)` (offers, campaigns, billing, onboarding),
   `(auth)` (login/signup), and `/admin/*`.
2. **Default locale: auto-detect** from `Accept-Language` (Hebrew preference →
   `he`, else `en`); a **language toggle** overrides and persists (cookie).
3. **AI outputs stay English** — never translated by this feature.
4. **Library: next-intl** (App Router, **without** locale-in-URL routing;
   cookie-based locale). Handles server + client components uniformly.

## Architecture

- **next-intl, no-routing setup:** `createNextIntlPlugin()` in `next.config.ts`;
  `src/i18n/request.ts` `getRequestConfig` resolves the active locale + loads
  `messages/<locale>.json`. The root layout wraps children in
  `NextIntlClientProvider` and sets `<html lang dir>` from the locale.
- **Locale resolution (pure, tested):** `src/i18n/locale.ts` exports
  `SUPPORTED_LOCALES = ['en','he']`, `DEFAULT_LOCALE`, and
  `resolveLocale(cookieValue, acceptLanguage)` → returns `'he'` if the cookie is
  `he`, `'en'` if the cookie is `en`, else `'he'` when `Accept-Language` prefers
  Hebrew, else `'en'`. `request.ts` calls this with the `locale` cookie +
  `Accept-Language` header.
- **Toggle:** `LanguageToggle` (client) calls a `setLocale` server action that
  writes the `locale` cookie and `revalidatePath('/', 'layout')`; placed in the
  app sidebar and the admin sidebar.
- **Messages:** `messages/en.json` + `messages/he.json`, namespaced
  (`common`, `nav`, `auth`, `onboarding`, `offers`, `campaigns`, `billing`,
  `admin`). Every key exists in BOTH files (en is the fallback).
- **Server components** use `getTranslations('ns')`; **client components** use
  `useTranslations('ns')`.

## RTL

- `<html dir>` = `rtl` for `he`, `ltr` for `en`.
- Convert the ~26 directional Tailwind utilities to logical ones: `pl-*`→`ps-*`,
  `pr-*`→`pe-*`, `ml-*`→`ms-*`, `mr-*`→`me-*`, `text-left`→`text-start`,
  `text-right`→`text-end`, `border-l`→`border-s`, `border-r`→`border-e`. The rest
  of the flow flips automatically from `dir`.

## Scope of strings

Static UI text only: nav, headings, labels, buttons, form fields/placeholders,
table headers, empty states, toasts/errors surfaced from the UI layer. NOT
translated: AI payloads, offer names, user data, and the dense free-text the
model produces.

## Phasing (each independently shippable + verifiable)

- **A — Infrastructure:** install next-intl, `locale.ts` (+ tests), `request.ts`,
  `next.config.ts` plugin, layout `dir/lang` + provider, `LanguageToggle` +
  `setLocale` action, the `common`/`nav` namespaces and the two sidebars.
- **B — Auth + onboarding:** `(auth)` + onboarding wizard.
- **C — App:** offers, campaigns, billing.
- **D — Admin:** all `/admin/*` pages.

## Testing / verification

- Unit: `resolveLocale` (cookie wins; Accept-Language fallback; default).
- After each task: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` green;
  every `t()` key present in both message files (a missing key must not crash —
  next-intl shows the key, which we treat as a failure to fix).
- Manual: toggle flips language + direction; refresh persists; AI outputs remain
  English.

## Out of scope

Translating AI outputs; locale in the URL; additional languages beyond he/en;
date/number localization beyond what next-intl gives for free.
