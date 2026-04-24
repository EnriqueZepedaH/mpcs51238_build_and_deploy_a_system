import Link from "next/link";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import {
  ArrowRight,
  Briefcase,
  Cpu,
  Database,
  Github,
  LayoutDashboard,
  LineChart,
  Lock,
  Radio,
  ShieldCheck,
  Waves
} from "lucide-react";

import { LandingTicker } from "@/components/landing-ticker";

export const dynamic = "force-dynamic";

const GITHUB_URL = "https://github.com/EnriqueZepedaH/mpcs51238_build_and_deploy_a_system";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
      <Nav />
      <Hero />
      <Architecture />
      <Features />
      <TechStack />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <nav className="flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-white">
          <Waves className="h-4 w-4" />
        </span>
        <span className="font-display text-sm font-semibold uppercase tracking-[0.22em]">
          Market Pulse
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-2 rounded-full border border-ink/10 bg-white/60 px-4 py-2 text-sm text-ink/80 transition hover:border-ink/30 hover:text-ink sm:inline-flex"
        >
          <Github className="h-4 w-4" />
          <span>Source</span>
        </a>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="rounded-full px-4 py-2 text-sm font-medium text-ink/80 transition hover:text-ink">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-tide">
              Sign up
            </button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-tide"
          >
            Open dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <UserButton />
        </SignedIn>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.22em] text-tide/80">
          <span className="h-1.5 w-1.5 rounded-full bg-ember" />
          Portfolio project · MPCS 51238
        </span>
        <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink md:text-6xl lg:text-[4.25rem]">
          A realtime market dashboard,{" "}
          <span className="text-tide">built like production.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
          Market Pulse tracks live prices, unrealized P&amp;L, and pipeline health for a private
          watchlist and portfolio — powered by a Railway worker, Supabase Realtime, and Next.js.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SignedOut>
            <SignUpButton mode="modal">
              <button className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide">
                Get started
                <ArrowRight className="h-4 w-4" />
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide"
            >
              Open dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </SignedIn>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/70 px-5 py-3 text-sm font-medium text-ink/80 transition hover:border-ink/30 hover:text-ink"
          >
            <Github className="h-4 w-4" />
            View source
          </a>
        </div>
      </div>
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-ember/20 via-white/0 to-tide/20 blur-2xl"
        />
        <LandingTicker />
      </div>
    </section>
  );
}

function Architecture() {
  const stages = [
    {
      icon: <Radio className="h-5 w-5" />,
      title: "Twelve Data",
      body: "Free-tier quote feed, batched inside credit limits."
    },
    {
      icon: <Cpu className="h-5 w-5" />,
      title: "Railway worker",
      body: "Staleness-aware scheduler unions watchlist + portfolio."
    },
    {
      icon: <Database className="h-5 w-5" />,
      title: "Supabase",
      body: "Current, history, and ops tables with row-level security."
    },
    {
      icon: <LayoutDashboard className="h-5 w-5" />,
      title: "Next.js on Vercel",
      body: "Realtime updates stream into the dashboard without refresh."
    }
  ];

  return (
    <section className="mt-28">
      <SectionHeader
        eyebrow="How it works"
        title="One coherent pipeline, four services."
        subtitle="Each hop is visible in the UI so outages and staleness never hide behind a loading spinner."
      />
      <ol className="mt-10 grid gap-4 md:grid-cols-4">
        {stages.map((stage, i) => (
          <li
            key={stage.title}
            className="panel relative flex flex-col gap-3 p-5"
          >
            <span className="absolute -top-3 left-5 rounded-full bg-ink px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.22em] text-white">
              Step {i + 1}
            </span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ember/10 text-ember">
              {stage.icon}
            </span>
            <h3 className="font-display text-lg font-semibold text-ink">{stage.title}</h3>
            <p className="text-sm leading-6 text-ink/65">{stage.body}</p>
            {i < stages.length - 1 ? (
              <ArrowRight
                aria-hidden
                className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-ink/25 md:block"
              />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  return (
    <section className="mt-28">
      <SectionHeader
        eyebrow="What it does"
        title="Track, analyze, and trust the numbers."
        subtitle="The product is small on purpose — every feature points at something load-bearing in the pipeline."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <FeatureCard
          icon={<Briefcase className="h-5 w-5" />}
          title="Portfolio tracking"
          body="Record buy lots, compute unrealized P&L live from current quotes, and fill missing cost basis from stored historical closes."
        />
        <FeatureCard
          icon={<LineChart className="h-5 w-5" />}
          title="Realtime watchlist"
          body="Prices stream in through Supabase Realtime. No polling loops in the browser — just diffs as the worker writes them."
        />
        <FeatureCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Private by default"
          body="Clerk-authenticated sessions, row-level security on every watchlist and portfolio row, and server-enforced limits."
        />
      </div>
    </section>
  );
}

function TechStack() {
  const stack = [
    "Next.js 14",
    "TypeScript",
    "Supabase",
    "Clerk",
    "Tailwind CSS",
    "Railway",
    "Twelve Data",
    "PostgreSQL"
  ];

  return (
    <section className="mt-28">
      <SectionHeader eyebrow="Stack" title="Built with a focused toolkit." />
      <div className="mt-8 flex flex-wrap gap-2">
        {stack.map((item) => (
          <span
            key={item}
            className="rounded-full border border-ink/10 bg-white/70 px-4 py-1.5 text-sm text-ink/75"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-28 flex flex-col items-start justify-between gap-4 border-t border-ink/10 py-8 text-sm text-ink/55 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5" />
        <span>Built by Enrique Zepeda-Herrera · MPCS 51238 Design, Build &amp; Ship</span>
      </div>
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 transition hover:text-ink"
      >
        <Github className="h-4 w-4" />
        <span>EnriqueZepedaH/mpcs51238_build_and_deploy_a_system</span>
      </a>
    </footer>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-display text-xs uppercase tracking-[0.24em] text-tide/70">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-base leading-7 text-ink/65">{subtitle}</p>
      ) : null}
    </div>
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
    <article className="panel flex flex-col gap-3 p-6">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-tide/10 text-tide">
        {icon}
      </span>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-6 text-ink/65">{body}</p>
    </article>
  );
}
