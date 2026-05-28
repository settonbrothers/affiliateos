# Tech Stack

> כל בחירה כאן סגורה. אם session של Claude רוצה לסטות (לדוגמה, "בוא נשתמש ב־tRPC במקום server actions") — עצור והחזר.

---

## Stack overview

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                              │
│  Next.js 15 (App Router) · React 19 · TypeScript strict       │
│  Tailwind v4 · shadcn/ui · React Hook Form · Zod              │
└────────────────────────────────┬─────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
   ┌──────────────┐    ┌──────────────────┐  ┌──────────────┐
   │ Server       │    │ Supabase Edge    │  │ Vercel Cron  │
   │ Actions      │    │ Functions (Deno) │  │ + Supabase   │
   │ (Next.js)    │    │ for long AI runs │  │   pg_cron    │
   └──────┬───────┘    └────────┬─────────┘  └──────┬───────┘
          │                     │                   │
          └─────────────────────┴───────────────────┘
                                │
                                ▼
                ┌────────────────────────────────┐
                │   Supabase (Postgres+Auth+     │
                │   Storage+Realtime)            │
                │   • RLS from day 1             │
                │   • Migrations only            │
                │   • Realtime on ai_runs        │
                └─────────────┬──────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌─────────────┐      ┌──────────────────┐    ┌────────────┐
│ Anthropic   │      │ Stripe           │    │ External   │
│ Sonnet 4.6  │      │ (M5+)            │    │ services   │
│ Haiku 4.5   │      │ subscription +   │    │ • Resend   │
│ JSON tool   │      │ metered credits  │    │ • Sentry   │
│ use         │      │                  │    │ • PostHog  │
└─────────────┘      └──────────────────┘    │ • Langfuse │
                                              └────────────┘
```

---

## Stack table — final picks

| שכבה | בחירה | אלטרנטיבות שנדחו | למה זה |
|---|---|---|---|
| **Frontend framework** | Next.js 15 App Router | Vite+React (יותר מהיר ל־dev אבל אין SSR), Remix (פחות מומנטום) | server actions ב־TS strict + SSR ל־SEO landing pages עתידיים + Stripe webhooks native + שיתוף Zod schemas client/server |
| **React version** | React 19 | React 18 | RSC + use() hook + form actions native |
| **TS** | TypeScript 5.7+, strict | JS, TS loose | אסור `any`, חובה null checks, Zod מטפל ב־boundaries |
| **Styling** | Tailwind v4 | CSS Modules, vanilla-extract | מהיר ל־dev, אתה כבר יודע, shadcn build על זה |
| **UI primitives** | shadcn/ui (Radix-based) | Material UI (כבד), Mantine (פחות mainstream), Chakra | אתה כבר משתמש בו ב־richer-ai-agents-hub, copy-paste ל־`src/components/ui/`, אפס lock-in |
| **Forms** | React Hook Form + Zod resolver | Formik (פחות פעיל), uncontrolled inputs (כאוס) | resolver יחיד לשני הצדדים (client validation + server validation דרך אותו schema) |
| **Validation** | Zod | yup (פחות TS-friendly), io-ts (curve תלולה) | schemas משותפים: `OfferCreateSchema` משמש ב־form, server action, ו־Supabase insert |
| **Routing** | Next App Router (file-based) | TanStack Router, react-router | מובנה ב־Next |
| **State (server)** | TanStack Query (client-side cache) | SWR, Apollo, Redux | מנהל cache invalidation דרך key-based, פועל מצוין עם Supabase |
| **State (UI)** | React useState + URL search params | Zustand, Jotai, Redux | אין צורך ב־global state ב־MVP |
| **DB / Auth / Storage / Realtime** | Supabase | self-hosted PG + Auth.js + S3 + Pusher (כאוס) | אחד שמטפל בארבעה. אתה כבר מכיר |
| **DB queries** | Supabase JS client + Zod | Drizzle ORM (overhead), Prisma (כבד) | client של Supabase + types שנגזרים מ־migrations |
| **Migrations** | Supabase CLI (`supabase db push`) + SQL files | Drizzle, Prisma migrate | זהה ל־richer-ai-agents-hub, אין למידה חדשה |
| **Auth** | Supabase Auth (magic link + email/password) | Clerk ($), NextAuth (כאוס config) | מובנה, RLS משתמש ב־`auth.uid()` native |
| **AI provider** | Anthropic SDK (`@anthropic-ai/sdk`) | OpenAI (לא מתאים ל־reasoning שאתה צריך), Google Vertex (overhead), Replicate | אותו ספק, אתה מכיר את ה־API, Claude מצויין ב־JSON tool use |
| **AI models** | Sonnet 4.6 (reasoning) + Haiku 4.5 (extraction/judge) | Opus (יקר מדי ל־MVP), Claude 3.5 (קודם, פחות טוב) | זהה ל־richer-ai-agents-hub, יחס price/performance מעולה |
| **AI structure** | Anthropic JSON tool use (forced) | Free-form JSON + parser (שביר), function calling proprietary | tool use מבטיח schema valid, פחות retries |
| **AI runtime** | Supabase Edge Function (Deno) | Next.js API route, Vercel function, AWS Lambda | Edge Functions תומכות ב־`EdgeRuntime.waitUntil` ל־background work (זהה ל־richer-ai-agents-hub) |
| **Long jobs** | Edge function + pg_cron + `claimed_by_cron_id` pattern | Inngest ($, אבל פשוט), BullMQ (Redis), Trigger.dev | תבנית מוכחת מ־richer-ai-agents-hub. בלי שירות חיצוני נוסף |
| **Realtime UI** | Supabase Realtime (Postgres publications) | Pusher ($), Ably ($), SSE custom | תבנית מוכחת מ־richer-ai-agents-hub (`messages` publication) |
| **Hosting** | Vercel | Lovable (לא תומך App Router אמיתי), Cloudflare Pages (עדיין מתפתח), self-hosted (overhead) | preview deploys לכל PR, edge runtime, native Next, אינטגרציית Stripe |
| **CDN / Assets** | Vercel built-in | Cloudflare | מובנה |
| **File storage** | Supabase Storage | S3 (overhead), Cloudflare R2 | מובנה, RLS על buckets, מתאים לשטחי תיק (PDFs, screenshots של ads ל־source ingestion) |
| **Payments** | Stripe | Paddle (overhead), LemonSqueezy (מוגבל) | מקובל בעולם, יש לזה SDK טוב ל־Next |
| **Email** | Resend | Postmark (טוב, יקר יותר), SES (overhead), SendGrid (UX רע) | API פשוט, React Email templates, $20/חודש ל־MVP |
| **Email templates** | React Email | MJML, raw HTML | אותם components של React = type safety + preview |
| **Observability (AI)** | Langfuse Cloud | LangSmith, Helicone, Phoenix | זהה ל־richer-ai-agents-hub. אתה כבר מכיר את ה־schema |
| **Observability (errors)** | Sentry | Datadog ($), Rollbar | חינמי עד 5k events/חודש, מעולה ל־Next.js, source maps automation |
| **Observability (product)** | PostHog | Mixpanel ($), Amplitude ($) | open-source, session replay, feature flags, A/B testing — חבילה אחת, $0 בעד 1M events |
| **Observability (uptime)** | Better Stack (formerly Better Uptime) | UptimeRobot (UX רע), Pingdom ($) | $30/חודש, אינטגרציית on-call (אתה ה־oncall, צריך SMS אם DB נופל) |
| **Testing (unit)** | Vitest | Jest (slow, deprecated for new projects) | מהיר, מובנה עם Vite/Vercel, TS native |
| **Testing (E2E)** | Playwright | Cypress, Selenium | אמין יותר, headless עם trace |
| **Testing (AI)** | Custom golden set + LLM-as-judge | Promptfoo, LangSmith eval | פשוט יותר ל־MVP, נשלוט בקוד שלנו |
| **Linting** | ESLint + @typescript-eslint | Biome (חדש, לא בשל) | סטנדרט |
| **Formatting** | Prettier | dprint, Biome | סטנדרט |
| **CI** | GitHub Actions | CircleCI, GitLab CI | חינמי בריפו פרטי עד 2000 min/חודש |
| **Package manager** | pnpm | bun (אתה משתמש ב־hub אבל פחות מסטנדרטי), npm (איטי), yarn (legacy) | מהיר, חוסך דיסק. אם תעדיף bun — כתב את זה ב־CLAUDE.md |
| **Node version** | 22 LTS | 20 LTS | תאם לדרישות של Next 15 |
| **Repo host** | GitHub (org: `settonbrothers`) | GitLab, Bitbucket | סטנדרט, אינטגרציה עם Vercel |
| **Branch protection** | main protected, PR-only, CI חובה | direct push | חובה לעבודה עם 7 sessions |

---

## Environments

| Env | למה | URL pattern |
|---|---|---|
| **Local** | פיתוח ב־localhost:3000 | `localhost:3000` |
| **Preview** | כל PR מקבל URL ייחודי (Vercel automatic) | `<branch>-affiliateos-settonbrothers.vercel.app` |
| **Staging** | branch `staging` עם DB Supabase נפרד | `staging.affiliateos.app` (TBD domain) |
| **Production** | branch `main`, DB Supabase production | `affiliateos.app` (TBD domain) |

**הערה על staging:** ב־M1-M4 אפשר להסתפק ב־preview deploys בלבד. Staging נכנס ב־M5 כש־Stripe נכנס לתמונה ואתה צריך לבדוק webhooks אמיתיים בלי לזהם prod.

---

## Supabase project setup

| מה | ערך |
|---|---|
| Project name | `affiliateos-prod` |
| Region | `eu-central-1` (Frankfurt) — לטיניות חזרה מ־Vercel iad1, ול־GDPR אם אי פעם |
| Plan | Pro ($25/חודש מהיום 1 — צריך daily backups, pgbouncer, no auto-pause) |
| Auth providers | Email/password + Magic link |
| Storage buckets | `source-documents` (private, admin only), `offer-logos` (public) |

---

## Anthropic setup

| מה | ערך |
|---|---|
| API key | סודי, ב־Supabase secrets + Vercel env |
| Default model | `claude-sonnet-4-6` (כפי שמופיע ב־richer-ai-agents-hub) |
| Cheap model | `claude-haiku-4-5-20251001` |
| Default max_tokens | 4096 (יותר ממה ש־hub משתמש כי כאן ה־outputs מובנים יותר) |
| JSON mode | Tool use (forced), אסור free-form |
| Prompt caching | `cache_control: { type: 'ephemeral' }` על system prompts ב־M4+ |
| Rate limit | התחל ב־default tier, monitor ב־Langfuse, שדרג לפי צורך |

---

## עלות חודשית משוערת ב־MVP (5-15 משתמשים)

| שירות | $/חודש |
|---|---|
| Vercel Pro | $20 (ל־team features + preview deploys + analytics) |
| Supabase Pro | $25 |
| Resend | $0 (3000 emails/חודש חינם, עוברים ל־$20 כשגדלים) |
| Sentry | $0 (5k events חינם) |
| PostHog | $0 (1M events חינם) |
| Better Stack | $30 |
| Anthropic | ~$100-300 (תלוי בשימוש; cap $500/חודש) |
| Stripe | $0 (2.9% + 30¢ per transaction, אבל אין fixed) |
| Domain | $1 (~$12/שנה) |
| **סה"כ** | **~$180-380/חודש** |

זה לפני שמשתמשים משלמים. עם 10 משתמשים × $50/חודש = $500 הכנסה, gross margin חיובי מההתחלה אם cost AI נשמר ב־$200.

---

## גרסאות פרוסות (pinned)

לעדכון פעם בשבועיים בלבד, לא בכל session:

| package | version |
|---|---|
| `next` | `^15.1.0` |
| `react` | `^19.0.0` |
| `typescript` | `^5.7.0` |
| `@supabase/ssr` | `^0.5.0` |
| `@supabase/supabase-js` | `^2.47.0` |
| `@anthropic-ai/sdk` | `^0.32.0` |
| `zod` | `^3.24.0` |
| `@tanstack/react-query` | `^5.62.0` |
| `react-hook-form` | `^7.54.0` |
| `tailwindcss` | `^4.0.0` |
| `stripe` | `^17.0.0` (M5) |
| `resend` | `^4.0.0` |
| `@sentry/nextjs` | `^8.45.0` |
| `posthog-js` | `^1.200.0` |

לעדכן כל גרסה? **לא בלי PR ייעודי**. Claude session שמקבל "תעדכן את כל ה־packages" — תעצור אותו.

---

## גישות שאסור לקחת

- **שום ORM**. Supabase client + Zod מספיק.
- **שום state library** (Redux/Zustand/Jotai). useState + URL params מספיק.
- **שום styled-components/emotion**. רק Tailwind.
- **שום TanStack Router**. רק Next App Router.
- **שום server framework שני** (Express, Hono, Fastify). רק Next server actions + Supabase Edge Functions.
- **שום LangChain/LlamaIndex/LangGraph**. ישירות `@anthropic-ai/sdk`.
- **שום Drizzle/Prisma**. כלי Supabase מספיק.
- **שום Vercel KV/Redis**. Supabase Postgres מטפל ב־cache עם table + TTL column.
- **שום queue חיצוני** (BullMQ/Inngest/Trigger.dev). Edge Function + pg_cron + `EdgeRuntime.waitUntil` מספיק.
- **שום auth שני** (Clerk/Auth.js). רק Supabase Auth.

אם אתה (או session) רוצה להפר אחד מאלה — דורש PR ייעודי עם הצדקה ב־`decisions/` folder.
