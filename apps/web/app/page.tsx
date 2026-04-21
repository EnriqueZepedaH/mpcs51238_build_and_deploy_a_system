import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Activity, DatabaseZap, RadioTower } from "lucide-react";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-display text-sm uppercase tracking-[0.24em] text-tide/70">
            Market Pulse
          </p>
          <h1 className="mt-2 max-w-3xl font-display text-5xl font-semibold leading-tight text-ink md:text-7xl">
            Realtime market data, built like a production pipeline.
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide"
            >
              Open dashboard
            </Link>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="panel overflow-hidden p-8">
          <div className="rounded-[2rem] bg-ink p-8 text-white">
            <p className="font-display text-sm uppercase tracking-[0.28em] text-white/60">
              Architecture
            </p>
            <p className="mt-4 text-2xl leading-relaxed text-white/90">
              Twelve Data feeds a Railway worker. The worker writes current and historical
              state into Supabase. Realtime changes stream straight into a Next.js dashboard
              on Vercel.
            </p>
          </div>

          <div className="mt-8 data-grid">
            <FeatureCard
              icon={<RadioTower className="h-6 w-6 text-ember" />}
              title="Realtime ingestion"
              body="Shared polling keeps the system inside free-tier limits while keeping high-demand symbols fresher."
            />
            <FeatureCard
              icon={<DatabaseZap className="h-6 w-6 text-ember" />}
              title="Layered storage"
              body="Serving, history, and ops metadata are separated so reliability and analytics stay visible."
            />
            <FeatureCard
              icon={<Activity className="h-6 w-6 text-ember" />}
              title="Ops in the UI"
              body="The dashboard exposes ingestion lag and error counts instead of pretending the pipeline never fails."
            />
          </div>
        </div>

        <aside className="panel flex flex-col justify-between p-8">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.24em] text-tide/70">
              Why this matters
            </p>
            <p className="mt-4 text-lg leading-8 text-ink/80">
              This app is intentionally structured like a small production system. The point is
              not just to render quotes. The point is to show ingestion, normalization, storage,
              realtime propagation, and operational visibility as one coherent pipeline.
            </p>
          </div>
          <div className="mt-10 rounded-[2rem] border border-ink/10 bg-white px-5 py-6">
            <p className="text-sm uppercase tracking-[0.22em] text-tide/70">Deliverables</p>
            <ul className="mt-4 space-y-3 text-sm text-ink/80">
              <li>Clerk auth with private watchlists</li>
              <li>Supabase-backed current and historical quote storage</li>
              <li>Realtime UI updates without manual refresh</li>
              <li>Worker health metrics for portfolio credibility</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-[1.75rem] border border-ink/10 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="rounded-2xl bg-ember/10 p-3">{icon}</span>
        <h2 className="font-display text-xl text-ink">{title}</h2>
      </div>
      <p className="mt-4 text-sm leading-7 text-ink/75">{body}</p>
    </article>
  );
}
