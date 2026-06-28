"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: "▦" },
  { href: "/dashboard/employees", labelKey: "nav.employees", icon: "▤" },
  { href: "/dashboard/advances", labelKey: "nav.advances", icon: "⟐" },
  { href: "/dashboard/payroll", labelKey: "nav.payroll", icon: "▣" },
  { href: "/dashboard/reports", labelKey: "nav.reports", icon: "▨" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex h-full min-h-0">
      <nav className="w-64 bg-sidebar flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <Link href="/dashboard" className="text-lg font-bold text-white tracking-tight">
            {t("app.title")}
          </Link>
          <p className="text-xs text-white/40 mt-0.5">{t("nav.company")}</p>
        </div>

        <div className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${
                  isActive
                    ? "bg-sidebar-active text-white"
                    : "text-white/60 hover:text-white hover:bg-sidebar-hover"
                }`}
              >
                <span className="text-lg w-5 text-center">{item.icon}</span>
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>

        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 text-xs text-white/40 truncate">
            {session?.user?.email}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="sidebar-link text-white/40 hover:text-white hover:bg-sidebar-hover w-full"
          >
            <span className="text-lg w-5 text-center">⏻</span>
            {t("nav.signOut")}
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-auto bg-surface">{children}</main>
    </div>
  );
}
