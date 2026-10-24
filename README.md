# Claude Campus Compass

Claude Campus Compass is a student-first web app for helping university students
navigate campus resources, policies, and everyday questions with more clarity.
The first milestone is a welcoming landing page. Chat and policy decision
features will be added in a later phase.

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

No Claude API key is required for the current landing page. When environment
variables are introduced, copy `.env.example` to `.env.local` and keep the
resulting file out of version control.
