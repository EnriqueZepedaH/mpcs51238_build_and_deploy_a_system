"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Activity, LayoutDashboard } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "Portfolio", icon: LayoutDashboard },
  { href: "/dashboard/observability", label: "Observability", icon: Activity }
] as const;

export function DashboardTabNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard tabs"
      className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white/70 p-1"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname?.startsWith(tab.href) ?? false;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-ink text-white shadow-sm"
                : "text-ink/65 hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
