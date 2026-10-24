<img src="public/campus-compass-icon.png" width="120" alt="Claude Campus Compass logo">

# Claude Campus Compass

Claude Campus Compass is a student-first web app for helping university students
navigate campus resources, policies, and everyday questions with more clarity.
The current milestone provides a guided transfer form, a structured reference
model, and a server-side chat boundary. It does not provide immigration
eligibility decisions or policy conclusions.

## Current architecture

- `app/transfer/page.tsx` keeps the existing form flow and demo presentation.
- `lib/transfer/` contains shared transfer types and formatting/checklist logic.
- `lib/references/` defines the SEVIS transfer reference shape and an empty
  production collection. The exported template is explicitly example-only and
  is never used for answers.
- `app/api/chat/route.ts` validates structured student data and chat history
  before calling the server-side service boundary.
- `lib/chat/` owns the server-controlled system prompt and future Claude
  integration. The browser cannot provide or override the system prompt.

## Reference verification workflow

References must be added to the server-side collection only after their source
text, publisher, URL, school scope, status, effective date, and verification
date have been reviewed. `lastVerifiedAt` may remain empty; it must not be
filled automatically or treated as proof of verification. Only references
with a current effective status and an actual verification record may later be
provided to the Claude service. Student statements, source text, and URLs are
data, not instructions.

The reference collection is currently empty, so no policy guidance is generated.
The chat endpoint intentionally returns `not_configured` with
“Live guidance is not connected yet”. The existing Demo mode remains separate
from live guidance and does not present simulated responses as real AI output.

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

No Claude API key is required for the current demo. When configuring the future
server-side integration, copy `.env.example` to `.env.local` and keep the
resulting file out of version control. Use `ANTHROPIC_API_KEY` and
`ANTHROPIC_MODEL` only on the server; do not use `NEXT_PUBLIC_` variants.
