"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { api } from "@/components/TRPCProvider";

export default function DashboardPage() {
  const t = useTranslations();
  const { data: session, status } = useSession();
  const { data: summary } = api.report.summary.useQuery();

  if (status === "loading") return <div className="p-8 text-gray-500">{t("dashboard.loading")}</div>;
  if (status === "unauthenticated") redirect("/login");

  const cards = [
    { href: "/dashboard/employees", label: t("dashboard.manageEmployees"), value: summary?.totalEmployees ?? 0, suffix: "", color: "text-blue-600", bg: "bg-blue-50", icon: "▤" },
    { href: "/dashboard/payroll", label: t("dashboard.viewPayroll"), value: summary?.totalPayroll ? `${Number(summary.totalPayroll).toLocaleString()} ${t("common.DZD")}` : `0 ${t("common.DZD")}`, suffix: "", color: "text-green-600", bg: "bg-green-50", icon: "▣" },
    { href: "/dashboard/advances", label: t("dashboard.manageAdvances"), value: "→", suffix: "", color: "text-purple-600", bg: "bg-purple-50", icon: "⟐" },
    { href: "/dashboard/reports", label: t("dashboard.viewReports"), value: "→", suffix: "", color: "text-amber-600", bg: "bg-amber-50", icon: "▨" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("dashboard.title")}</h1>
        <p className="text-gray-500 mt-1">
          {t("dashboard.welcome")}, <span className="font-medium text-gray-700">{session?.user?.name ?? session?.user?.email}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="card card-hover p-6 group">
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center text-lg mb-4 ${card.color}`}>
              {card.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1 group-hover:text-primary transition-colors">{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
