import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Waves } from "lucide-react";

import { DashboardTabNav } from "@/components/dashboard-tab-nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-3 text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white">
            <Waves className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-xs uppercase tracking-[0.24em] text-tide/70">
              Market Pulse
            </p>
            <p className="font-display text-base font-semibold text-ink">Dashboard</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <DashboardTabNav />
          <UserButton />
        </div>
      </header>

      <div className="mt-8">{children}</div>
    </main>
  );
}
