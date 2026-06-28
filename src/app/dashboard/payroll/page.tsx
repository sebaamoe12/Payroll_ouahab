"use client";

import { useTranslations } from "next-intl";
import { api } from "@/components/TRPCProvider";
import React, { useState } from "react";
import { useToast } from "@/components/ui/toast";

export default function PayrollPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const { data, refetch } = api.employeePayroll.overview.useQuery();
  const payMutation = api.employeePayroll.pay.useMutation({ onSuccess: () => { refetch(); toast("Paie effectuée avec succès", "success"); }, onError: (err) => toast(err.message, "error") });
  const payAllMutation = api.employeePayroll.payAll.useMutation({ onSuccess: (res) => { refetch(); toast(`${res.paid} paies effectuées · ${formatCurrency(res.total)}`, "success"); }, onError: (err) => toast(err.message, "error") });
  const payEmployeeAllMutation = api.employeePayroll.payEmployeeAll.useMutation({ onSuccess: (res) => { refetch(); toast(`${res.paid} mois payés pour cet employé · ${formatCurrency(res.total)}`, "success"); }, onError: (err) => toast(err.message, "error") });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const formatCurrency = (val: number) => val.toLocaleString("fr-FR") + " DZD";
  const monthLabel = (m: number, y: number) => {
    const d = new Date(y, m - 1);
    return d.toLocaleString("fr-FR", { month: "long" }) + " " + y;
  };

  const items = data?.items ?? [];
  const filtered = items.filter((emp) =>
    emp.employeeName.toLowerCase().includes(search.toLowerCase())
  );

  const allMonths = items.flatMap((emp) =>
    emp.months.map((m) => ({ ...m, employeeId: emp.employeeId }))
  );
  const pendingMonths = allMonths.filter((m) => m.status === "PENDING");
  const paidMonths = allMonths.filter((m) => m.status === "PAID");
  const notDueMonths = allMonths.filter((m) => m.status === "NOT_DUE");
  const totalPaidAll = paidMonths.reduce((s, p) => s + p.netSalary, 0);

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("payroll.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{items.length} employés · {allMonths.length} mois · {paidMonths.length} payés</p>
        </div>
        <button
          onClick={() => payAllMutation.mutate()}
          disabled={payAllMutation.isPending || pendingMonths.length === 0}
          className="btn btn-primary"
        >
          {payAllMutation.isPending ? "..." : `Tout payer (${pendingMonths.length})`}
        </button>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="card px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-8 rounded-full bg-red-500" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{t("payroll.totalPending")}</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(data?.totalPendingAmount ?? 0)}</p>
          </div>
        </div>
        <div className="card px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-8 rounded-full bg-green-500" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{t("payroll.totalPaid")}</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaidAll)}</p>
          </div>
        </div>
        <div className="card px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-8 rounded-full bg-gray-300" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{t("payroll.notDue")}</p>
            <p className="text-lg font-bold text-gray-400">{notDueMonths.length} mois</p>
          </div>
        </div>
        <div className="ml-auto">
          <input
            type="text"
            placeholder="Filtrer par nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-56"
          />
        </div>
      </div>

      {/* Per-employee mini cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
        {filtered.map((emp) => {
          const empPaid = emp.months.filter((m) => m.status === "PAID");
          const empPending = emp.months.filter((m) => m.status === "PENDING");
          const empTotalPaid = empPaid.reduce((s, m) => s + m.netSalary, 0);
          const empTotalPending = empPending.reduce((s, m) => s + m.netSalary, 0);
          return (
            <div
              key={emp.employeeId}
              onClick={() => toggleExpand(emp.employeeId)}
              className="card card-hover p-4 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{emp.employeeName}</p>
                  <p className="text-xs text-gray-400">{emp.employeePosition} · Paie jour {emp.payDay}</p>
                </div>
                <span className="badge badge-blue">{emp.months.length} mois</span>
              </div>
              <div className="flex gap-4 mt-3 text-sm">
                <div>
                  <span className="text-gray-400">Payé: </span>
                  <span className="font-semibold text-green-600">{formatCurrency(empTotalPaid)}</span>
                </div>
                {empTotalPending > 0 && (
                  <div>
                    <span className="text-gray-400">En attente: </span>
                    <span className="font-semibold text-red-600">{formatCurrency(empTotalPending)}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-green-500 to-yellow-500"
                  style={{ width: `${emp.months.length > 0 ? Math.round((empPaid.length / emp.months.length) * 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{empPaid.length}/{emp.months.length} mois payés</p>
            </div>
          );
        })}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t("payroll.employee")}</th>
              <th>{t("payroll.month")}</th>
              <th className="text-center">{t("payroll.payDay")}</th>
              <th className="text-right">{t("payroll.baseSalary")}</th>
              <th className="text-right">{t("payroll.advancesDeducted")}</th>
              <th className="text-right">{t("payroll.netSalary")}</th>
              <th>{t("payroll.status")}</th>
              <th>{t("employees.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => {
              const isExpanded = expanded[emp.employeeId] ?? false;
              const pendingCount = emp.months.filter((m) => m.status === "PENDING").length;
              return (
                <React.Fragment key={emp.employeeId}>
                  <tr
                    key={emp.employeeId}
                    onClick={() => toggleExpand(emp.employeeId)}
                    className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                  >
                    <td colSpan={8} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                        <span className="font-semibold text-gray-700">{emp.employeeName}</span>
                        <span className="text-xs text-gray-400 ml-1">{emp.employeePosition}</span>
                        {pendingCount > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); payEmployeeAllMutation.mutate({ employeeId: emp.employeeId }); }}
                            disabled={payEmployeeAllMutation.isPending}
                            className="btn btn-sm btn-primary ml-auto"
                          >
                            {payEmployeeAllMutation.isPending ? "..." : `Tout payer (${pendingCount})`}
                          </button>
                        )}
                        <span className="text-xs text-gray-400 ml-2">
                          depuis {monthLabel(+emp.startDate.slice(5, 7), +emp.startDate.slice(0, 4))}
                          {isExpanded ? "" : ` · ${pendingCount} mois en attente`}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && emp.months.map((m) => (
                    <tr key={`${emp.employeeId}_${m.month}_${m.year}`}>
                      <td className="text-sm text-gray-400">{emp.employeeName}</td>
                      <td className="text-sm">{monthLabel(m.month, m.year)}</td>
                      <td className="text-center"><span className="badge badge-blue">{emp.payDay}</span></td>
                      <td className="text-right text-sm">{formatCurrency(m.baseSalary)}</td>
                      <td className="text-right text-sm text-red-600">
                        {m.totalAdvances > 0 ? `-${formatCurrency(m.totalAdvances)}` : "—"}
                      </td>
                      <td className="text-right text-sm font-semibold">{formatCurrency(m.netSalary)}</td>
                      <td>
                        {m.status === "PAID" ? <span className="badge badge-green">{t("payroll.paid")}</span> :
                         m.status === "PENDING" ? <span className="badge badge-yellow">{t("payroll.pending")}</span> :
                         <span className="badge badge-gray">{t("payroll.notDue")}</span>}
                      </td>
                      <td>
                        {m.status === "PENDING" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); payMutation.mutate({ employeeId: emp.employeeId, periodMonth: m.month, periodYear: m.year }); }}
                            disabled={payMutation.isPending}
                            className="btn btn-sm btn-primary"
                          >
                            {t("payroll.payNow")}
                          </button>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-400 py-8">{t("payroll.allPaid")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
