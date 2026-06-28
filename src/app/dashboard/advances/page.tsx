"use client";

import { useTranslations } from "next-intl";
import { api } from "@/components/TRPCProvider";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";

const ADVANCE_TYPES = ["SALARY", "EMERGENCY", "MEDICAL", "OTHER"] as const;
const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED", "PAID"] as const;

export default function AdvancesPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { data: advances, refetch } = api.advance.list.useQuery(
    statusFilter !== "ALL" ? { status: statusFilter as any } : undefined
  );
  const { data: employees } = api.employee.list.useQuery();
  const createAdvance = api.advance.create.useMutation({ onSuccess: () => { refetch(); toast("Avance créée avec succès", "success"); }, onError: (err) => toast(err.message, "error") });
  const updateAdvance = api.advance.update.useMutation({ onSuccess: () => { refetch(); toast("Avance modifiée avec succès", "success"); }, onError: (err) => toast(err.message, "error") });
  const deleteAdvance = api.advance.delete.useMutation({ onSuccess: () => { refetch(); toast("Avance supprimée", "success"); }, onError: (err) => toast(err.message, "error") });
  const approveAdvance = api.advance.approve.useMutation({ onSuccess: () => { refetch(); toast("Avance approuvée", "success"); }, onError: (err) => toast(err.message, "error") });
  const rejectAdvance = api.advance.reject.useMutation({ onSuccess: () => { refetch(); toast("Avance rejetée", "success"); }, onError: (err) => toast(err.message, "error") });
  const markPaidAdvance = api.advance.markPaid.useMutation({ onSuccess: () => { refetch(); toast("Avance marquée payée", "success"); }, onError: (err) => toast(err.message, "error") });

  const [showForm, setShowForm] = useState(false);
  const [showEdit, setShowEdit] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeId: "", amount: 0, type: "SALARY" as string, reason: "" });
  const [editForm, setEditForm] = useState({ id: "", amount: 0, type: "SALARY" as string, reason: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createAdvance.mutate({ ...form, type: form.type as "SALARY" | "EMERGENCY" | "MEDICAL" | "OTHER", date: new Date().toISOString() });
    setForm({ employeeId: "", amount: 0, type: "SALARY", reason: "" });
    setShowForm(false);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    updateAdvance.mutate({ id: editForm.id, data: { amount: editForm.amount, type: editForm.type as any, reason: editForm.reason } });
    setShowEdit(null);
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: "badge badge-yellow",
      APPROVED: "badge badge-green",
      REJECTED: "badge badge-red",
      PAID: "badge badge-blue",
    };
    return map[status] ?? "badge badge-gray";
  };

  const formatCurrency = (val: string | number) =>
    Number(val).toLocaleString("fr-FR") + " DZD";

  const activeAdvances = (advances ?? []).filter(a => a.status !== "REJECTED" && !a.appliedInPayrollId && !a.appliedInEmployeePayrollId);

  const employeeBalanceMap = new Map<string, { baseSalary: number; used: number; remaining: number }>();
  for (const emp of employees ?? []) {
    const used = activeAdvances
      .filter(a => a.employeeId === emp.id)
      .reduce((s, a) => s + Number(a.amount), 0);
    const base = Number(emp.baseSalary);
    employeeBalanceMap.set(emp.id, { baseSalary: base, used, remaining: base - used });
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("advances.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{advances?.length ?? 0} demandes</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? t("advances.cancel") : t("advances.new")}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-6 mb-8 grid grid-cols-2 gap-4">
          <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="input" required>
            <option value="">{t("advances.selectEmployee")}</option>
            {employees?.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </select>
          <input placeholder={t("advances.amount")} type="number" value={form.amount || ""}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="input" required />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
            {ADVANCE_TYPES.map((type) => (
              <option key={type} value={type}>{t(`advances.advanceTypes.${type.toLowerCase()}`)}</option>
            ))}
          </select>
          <input placeholder={t("advances.reasonPlaceholder")} value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input" />
          <div className="col-span-2 flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary" disabled={createAdvance.isPending}>{createAdvance.isPending ? "..." : t("advances.save")}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">{t("advances.cancel")}</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`btn btn-sm ${statusFilter === f ? "btn-primary" : "btn-secondary"}`}
          >
            {f === "ALL" ? t("common.all") : t(`advances.${f.toLowerCase()}`)}
          </button>
        ))}
      </div>

      {/* Per-employee remaining balance */}
      {employees && advances && (
        <div className="card p-4 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">{t("advances.remainingBalance")}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {employees
              .filter((e) => e.status === "ACTIVE")
              .map((emp) => {
                const info = employeeBalanceMap.get(emp.id);
                if (!info) return null;
                const pct = info.baseSalary > 0 ? Math.round((info.used / info.baseSalary) * 100) : 0;
                return (
                  <div key={emp.id} className="rounded-lg bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t("employees.baseSalary")}: {formatCurrency(info.baseSalary)}</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className={`text-lg font-bold ${info.remaining < 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatCurrency(Math.max(info.remaining, 0))}
                      </span>
                      <span className="text-xs text-gray-400">{t("advances.remaining")}</span>
                    </div>
                    <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(info.used)} {t("advances.used")} ({pct}%)</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t("advances.employee")}</th>
              <th className="text-right">{t("advances.amount")}</th>
              <th>{t("advances.type")}</th>
              <th>{t("advances.date")}</th>
              <th>{t("advances.reason")}</th>
              <th>{t("advances.status")}</th>
              <th className="text-right">{t("advances.remainingBalance")}</th>
              <th>{t("employees.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {advances?.map((adv) => (
              <tr key={adv.id}>
                <td className="font-medium">{(adv as any).employee?.firstName ?? ""} {(adv as any).employee?.lastName ?? ""}</td>
                <td className="text-right">{Number(adv.amount).toLocaleString()} {t("common.DZD")}</td>
                <td>{t(`advances.advanceTypes.${adv.type.toLowerCase()}`)}</td>
                <td className="text-gray-500">{new Date(adv.date).toLocaleDateString("fr-FR")}</td>
                <td className="text-gray-500 max-w-[160px] truncate">{adv.reason ?? "—"}</td>
                <td>
                  <span className={statusBadge(adv.status)}>
                    {t(`advances.${adv.status.toLowerCase()}`)}
                  </span>
                </td>
                <td className="text-right">
                  <span className={`text-sm font-medium ${(employeeBalanceMap.get(adv.employeeId)?.remaining ?? 0) < 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(Math.max(employeeBalanceMap.get(adv.employeeId)?.remaining ?? 0, 0))}
                  </span>
                </td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    {adv.status === "PENDING" && !adv.appliedInPayrollId && !adv.appliedInEmployeePayrollId && (
                      <>
                        <button onClick={() => approveAdvance.mutate(adv.id)} disabled={approveAdvance.isPending} className="btn btn-sm btn-primary" title={t("advances.approve")}>✓</button>
                        <button onClick={() => rejectAdvance.mutate(adv.id)} disabled={rejectAdvance.isPending} className="btn btn-sm btn-danger" title={t("advances.reject")}>✗</button>
                      </>
                    )}
                    {adv.status === "APPROVED" && !adv.appliedInPayrollId && !adv.appliedInEmployeePayrollId && (
                      <button onClick={() => markPaidAdvance.mutate(adv.id)} disabled={markPaidAdvance.isPending} className="btn btn-sm btn-primary">{t("advances.markPaid")}</button>
                    )}
                    {!adv.appliedInPayrollId && !adv.appliedInEmployeePayrollId && adv.status !== "PAID" && (
                      <button onClick={() => { setEditForm({ id: adv.id, amount: Number(adv.amount), type: adv.type, reason: adv.reason ?? "" }); setShowEdit(adv.id); }} disabled={updateAdvance.isPending} className="btn btn-sm btn-ghost">{t("advances.edit")}</button>
                    )}
                    {!adv.appliedInPayrollId && !adv.appliedInEmployeePayrollId && (
                      <button onClick={() => setShowDelete(adv.id)} disabled={deleteAdvance.isPending} className="btn btn-sm btn-ghost text-red-600">{t("advances.delete")}</button>
                    )}
                    {(adv.appliedInPayrollId || adv.appliedInEmployeePayrollId) && (
                      <span className="text-xs text-gray-400 italic">Appliquée à la paie</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {advances?.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-400 py-8">{t("advances.noAdvances")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div className="modal-backdrop" onClick={() => setShowEdit(null)}>
          <form onSubmit={handleEdit} className="modal-content space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">{t("advances.edit")}</h2>
            <input type="number" placeholder={t("advances.amount")} value={editForm.amount || ""}
              onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} className="input" required />
            <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="input">
              {ADVANCE_TYPES.map((type) => (
                <option key={type} value={type}>{t(`advances.advanceTypes.${type.toLowerCase()}`)}</option>
              ))}
            </select>
            <input placeholder={t("advances.reasonPlaceholder")} value={editForm.reason}
              onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} className="input" />
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn btn-primary" disabled={updateAdvance.isPending}>{updateAdvance.isPending ? "..." : t("employees.save")}</button>
              <button type="button" onClick={() => setShowEdit(null)} className="btn btn-secondary">{t("advances.cancel")}</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <div className="modal-backdrop" onClick={() => setShowDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">{t("advances.confirmDelete")}</h2>
            <p className="text-sm text-gray-500 mt-2">{t("advances.deleteConfirmMsg")}</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { deleteAdvance.mutate(showDelete); setShowDelete(null); }} disabled={deleteAdvance.isPending} className="btn btn-danger flex-1">
                {deleteAdvance.isPending ? "..." : t("advances.delete")}
              </button>
              <button onClick={() => setShowDelete(null)} className="btn btn-secondary flex-1">
                {t("advances.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
