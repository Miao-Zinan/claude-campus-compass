<p align="center">
  <img src="public/campus-compass-icon.png"
       alt="Claude Campus Compass logo"
       width="120">
</p>

<h1 align="center">Claude Campus Compass</h1>

Claude Campus Compass helps F-1 international students enrolled at U.S. colleges and universities prepare for their first SEVIS transfer. It is designed for students who are unfamiliar with the process and unsure which information to gather or what to ask their international student advisers.

The project aims to turn verified government guidance and school-specific instructions into understandable explanations, personalized preparation checklists, and focused questions for a Designated School Official (DSO).

## Community and problem

Our initial community is F-1 international students in the United States navigating a SEVIS transfer for the first time. Transfer information is spread across government websites and individual school pages, and students may struggle to distinguish general requirements from school-specific procedures.

The project grew out of the founder’s own experience trying to understand student-status requirements and transfer procedures.

## Current development status

The current prototype includes a guided intake form, a situation summary, a preparation checklist, a server-side Claude chat service with citations, and on-demand structured preparation plan generation. Verified federal F-1 guidance is available, with limited UC Berkeley transfer-out guidance only when the current school is precisely matched as UC Berkeley. Other school-specific guidance and complete OPT-specific transfer coverage are not available. The tool does not make immigration eligibility decisions or replace guidance from a DSO or qualified immigration attorney. Refreshing the page clears the in-memory chat, plan, and checkbox state.

## Current architecture

- `app/transfer/page.tsx` keeps the existing form flow and demo presentation.
- `lib/transfer/` contains shared transfer types and formatting/checklist logic.
- `lib/references/` defines the SEVIS transfer reference shape and the small
  reviewed production collection. The exported template is explicitly
  example-only and is never used for answers.
- `app/api/chat/route.ts` validates structured student data and chat history
  before calling the server-side service boundary.
- `lib/chat/` owns the server-controlled system prompt and Claude service.
  It uses Anthropic's official TypeScript SDK and document citations. The
  browser cannot provide or override the system prompt.
- `app/api/chat` and `app/api/plan` use a small in-memory, per-process request
  guard for body-size, rate, and concurrency limits. This protects one running
  instance only; a multi-instance or serverless deployment needs a shared
  rate-limit service or an upstream gateway for global quota protection.

## Reference verification workflow

References must be added to the server-side collection only after their source
text, publisher, URL, school scope, status, effective date, and verification
date have been reviewed. `lastVerifiedAt` may remain empty; it must not be
filled automatically or treated as proof of verification. Only references
with a current effective status and an actual verification record may later be
provided to the Claude service. Student statements, source text, and URLs are
data, not instructions.

The chat endpoint only supplies currently active, reviewed references to the
Claude service. Unverified references are excluded. Berkeley-specific material
is returned only for a precisely matched current UC Berkeley school, and
ordinary federal guidance is not treated as a complete OPT or other-status
workflow. The existing Demo mode remains separate from live guidance and does
not present simulated responses as real AI output.

## Tech stack

- Next.js with the App Router
- TypeScript
- Tailwind CSS

## Local development

Requirements: Node.js 20.9 or newer.

```bash
npm.cmd install
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Create a production build and run it locally with:

```bash
npm.cmd run build
npm.cmd run start
```

Claude API access is server-side only. To enable live guidance locally:

1. Copy `.env.example` to `.env.local`.
2. Set `ANTHROPIC_API_KEY` to your local Anthropic API key.
3. Set `ANTHROPIC_MODEL` to a model ID currently available to your Anthropic
   account, using Anthropic's official model documentation or Console as the
   source of truth. The application intentionally does not hard-code or guess
   a model ID.
4. Set `AI_REQUESTS_ENABLED=true` to allow paid AI requests. Any other value,
   including a missing or empty variable and `false`, pauses paid AI requests
   while leaving the pages, forms, and existing in-memory results available.
5. For Preview and Production deployments, set `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` from the Upstash Redis Console. These are
   server-only variables; never use a `NEXT_PUBLIC_` prefix.
6. Restart the development server.

Keep `.env.local` out of version control. Do not use `NEXT_PUBLIC_` variables
for the key or Redis credentials. If either Anthropic variable is empty, the
endpoint returns `not_configured` without calling Claude. In Preview and
Production, missing or unavailable Redis returns HTTP 503 and never calls
Claude. In local development without Redis configuration, the existing
single-instance in-memory protection is used instead. This repository does not
claim that a live API request or Redis connection has been tested unless one is
explicitly run with local configuration. `ANTHROPIC_MODEL` must be selected from
the model IDs currently
documented by Anthropic or shown in the Anthropic Console; the application does
not guess a model ID. Citation behavior follows Anthropic's official
[Messages API](https://platform.claude.com/docs/en/api/messages) and
[citations documentation](https://platform.claude.com/docs/en/build-with-claude/citations).
Chat and preparation-plan requests each make one upstream Claude attempt:
server-side SDK retries are disabled for both endpoints. The page retains
manual retry actions, but it never automatically resends a failed request.

### Shared AI request limits

Preview and Production use Upstash Redis through the official
`@upstash/redis` SDK. An atomic Redis script checks and increments both limits
before Claude is called:

- Chat: 12 requests per UTC minute and 100 requests per UTC day.
- Preparation plan: 4 requests per UTC minute and 20 requests per UTC day.

These are whole-application limits across all users and instances, not per-user
allocations and not an exact dollar budget. Short-term exhaustion returns HTTP
429 with a minute-based `Retry-After`; daily exhaustion returns HTTP 429 with a
next-UTC-day `Retry-After`. Redis failures and timeouts fail closed with HTTP
503 rather than bypassing the limiter. The SDK's allow-on-timeout behavior is
not used. The in-memory concurrent-request cap remains only a per-instance
defense and is not a global concurrency limit.

### Deployment checks

The deployment must run the App Router API routes in a Node.js runtime with
outbound HTTPS access to Anthropic, server-only environment variables, and
route execution limits of at least 30 seconds for chat and 70 seconds for plan
generation. The configured platform must allow the selected model, request
body sizes, and the required function duration under its actual plan; these
limits are not assumed to be available on every hosting tier. `ANTHROPIC_API_KEY`
must never use a `NEXT_PUBLIC_` prefix. The built-in request guard is only
single-instance protection and must be replaced or supplemented by a shared
limiter before multi-instance production use.
