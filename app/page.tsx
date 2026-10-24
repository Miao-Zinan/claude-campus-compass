import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f8f7f3] text-[#17231e]">
      <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-[#d9e8d9] blur-3xl" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7 lg:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1d4d3a] text-lg font-bold text-white">
            CC
          </span>
          <span className="text-lg font-semibold tracking-tight">Claude Campus Compass</span>
        </div>
        <span className="rounded-full border border-[#cbd7cc] px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[#55705d]">
          Interactive Demo
        </span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-8 lg:px-10 lg:py-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#be6b43]">
              For international students in the U.S.
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-6xl">
              Your next step starts with a clearer plan.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#53625a] sm:text-lg">
              Navigate your F-1 SEVIS transfer with guided questions, a personalized
              checklist, and a summary to discuss with your school&apos;s international
              student adviser.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/transfer"
                className="inline-flex items-center gap-3 rounded-full bg-[#1d4d3a] px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-[#28634b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4d3a]"
              >
                Plan My SEVIS Transfer
                <span aria-hidden="true" className="text-lg">-&gt;</span>
              </Link>
              <Link
                href="/transfer?example=1"
                className="inline-flex items-center rounded-full border border-[#b8c8ba] px-6 py-3.5 text-sm font-semibold text-[#1d4d3a] transition-colors hover:bg-[#eaf0e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4d3a]"
              >
                Try an Example
              </Link>
            </div>
          </section>

          <aside className="rounded-[2rem] border border-[#d7e0d6] bg-white/70 p-7 shadow-[0_24px_70px_rgba(39,67,48,0.1)] backdrop-blur-sm sm:p-8">
            <div className="mb-9 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#55705d]">What you&apos;ll walk away with</span>
              <span className="h-3 w-3 rounded-full bg-[#e6a26f]" />
            </div>
            <div className="space-y-5">
              {[
                "A summary of your situation",
                "A step-by-step preparation checklist",
                "Questions to confirm with your DSO",
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-4 rounded-2xl bg-[#f1f5ef] p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d8e8d9] text-sm font-bold text-[#1d4d3a]">
                    0{index + 1}
                  </span>
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm leading-6 text-[#718078]">
              <strong className="font-semibold text-[#53625a]">Powered by Claude</strong>
              <br />
              Demo mode — AI responses and verified policy sources are not connected yet.
            </p>
          </aside>
        </div>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 py-7 text-xs leading-5 text-[#718078] lg:px-10">
        Independent student project providing information navigation. Confirm your
        personal situation with your school adviser.
      </footer>
    </div>
  );
}
