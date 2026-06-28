"use client";

import { useTranslations } from "next-intl";
import { api } from "@/components/TRPCProvider";

export default function ReportsPage() {
  const t = useTranslations();
  const { data: overview } = api.report.monthlyOverview.useQuery();
  const { data: summary } = api.report.summary.useQuery();

  const formatCurrency = (val: number) =>
    val.toLocaleString("fr-FR") + " DZD";

  const totalPaid = (overview ?? []).reduce((s, m) => s + m.total, 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("reports.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">Synthèse financière de l'entreprise</p>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="card p-6">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-lg text-blue-600 mb-3">▤</div>
          <p className="text-3xl font-bold text-gray-900">{summary?.totalEmployees ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">{t("reports.totalActiveEmployees")}</p>
        </div>
        <div className="card p-6">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-lg text-green-600 mb-3">▣</div>
          <p className="text-3xl font-bold text-gray-900">
            {summary?.totalPayroll ? formatCurrency(Number(summary.totalPayroll)) : `0 ${t("common.DZD")}`}
          </p>
          <p className="text-sm text-gray-500 mt-1">{t("reports.currentMonthTotal")}</p>
        </div>
        <div className="card p-6">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-lg text-purple-600 mb-3">∑</div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalPaid)}</p>
          <p className="text-sm text-gray-500 mt-1">{t("reports.payrollHistory")}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("reports.payrollHistory")}</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t("reports.period")}</th>
              <th>{t("reports.status")}</th>
              <th className="text-right">{t("reports.employees")}</th>
              <th className="text-right">{t("reports.total")}</th>
            </tr>
          </thead>
          <tbody>
            {overview?.map((month) => (
              <tr key={`${month.year}_${month.month}`}>
                <td className="font-medium">
                  {new Date(0, month.month - 1).toLocaleString("fr-FR", { month: "long" })} {month.year}
                </td>
                <td>
                  <span className={`badge ${month.pending === 0 ? "badge-green" : month.paid > 0 ? "badge-yellow" : "badge-gray"}`}>
                    {month.pending === 0 ? t("payroll.paid") : `${month.paid}/${month.employees} ${t("payroll.paid").toLowerCase()}`}
                  </span>
                </td>
                <td className="text-right">{month.employees}</td>
                <td className="text-right font-semibold">{formatCurrency(month.total)}</td>
              </tr>
            ))}
            {overview?.length === 0 && (
              <tr><td colSpan={4} className="text-center text-gray-400 py-8">Aucune paie enregistrée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
