"use client";

import { useTranslations } from "next-intl";
import { api } from "@/components/TRPCProvider";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";

export default function EmployeesPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const { data: employees, refetch } = api.employee.list.useQuery();
  const toggleStatus = api.employee.toggleStatus.useMutation({ onSuccess: () => { refetch(); toast("Statut mis à jour", "success"); }, onError: (err) => toast(err.message, "error") });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", baseSalary: 0, startDate: "", payDay: 1,
  });

  const createEmployee = api.employee.create.useMutation({
    onSuccess: () => {
      refetch();
      toast("Employé ajouté avec succès", "success");
      setShowForm(false);
      setForm({ firstName: "", lastName: "", baseSalary: 0, startDate: "", payDay: 1 });
    },
    onError: (err) => toast(err.message, "error"),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createEmployee.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      baseSalary: form.baseSalary,
      startDate: new Date(form.startDate).toISOString(),
      payDay: form.payDay,
      position: "Employé",
    });
  }

  const totalPayout = (emp: any) =>
    (emp.payrollRecords ?? []).reduce((s: number, r: any) => s + Number(r.netSalary), 0);

  const formatCurrency = (val: number) => val.toLocaleString("fr-FR") + " DZD";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("employees.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{employees?.length ?? 0} employés</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? t("employees.cancel") : t("employees.add")}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 mb-8 grid grid-cols-2 gap-4">
          <input placeholder={t("employees.firstName")} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" required />
          <input placeholder={t("employees.lastName")} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" required />
          <input placeholder={t("employees.salaryDZD")} type="number" value={form.baseSalary || ""} onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })} className="input" required />
          <input placeholder={t("employees.startDate")} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input" required />
          <input placeholder={t("employees.payDay")} type="number" min="1" max="31" value={form.payDay} onChange={(e) => setForm({ ...form, payDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} className="input" />
          <div className="col-span-2 flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary" disabled={createEmployee.isPending}>
              {createEmployee.isPending ? t("employees.saving") : t("employees.save")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">{t("employees.cancel")}</button>
          </div>
        </form>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t("employees.name")}</th>
              <th className="text-right">{t("employees.baseSalary")}</th>
              <th className="text-right">Total versé</th>
              <th>{t("employees.payDay")}</th>
              <th>{t("employees.startDate")}</th>
              <th>{t("employees.status")}</th>
              <th>{t("employees.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {employees?.map((emp) => (
              <tr key={emp.id}>
                <td className="font-medium">{emp.firstName} {emp.lastName}</td>
                <td className="text-right">{Number(emp.baseSalary).toLocaleString()} {t("common.DZD")}</td>
                <td className="text-right text-green-600 font-medium">
                  {formatCurrency(totalPayout(emp))}
                </td>
                <td><span className="badge badge-blue">{emp.payDay}</span></td>
                <td className="text-gray-500">{new Date(emp.startDate).toLocaleDateString("fr-FR")}</td>
                <td>
                  <span className={`badge ${emp.status === "ACTIVE" ? "badge-green" : "badge-gray"}`}>
                    {emp.status === "ACTIVE" ? t("employees.active") : t("employees.inactive")}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => toggleStatus.mutate({ id: emp.id, status: emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                    disabled={toggleStatus.isPending}
                    className="btn btn-sm btn-ghost"
                  >
                    {emp.status === "ACTIVE" ? t("employees.deactivate") : t("employees.activate")}
                  </button>
                </td>
              </tr>
            ))}
            {employees?.length === 0 && (
              <tr><td colSpan={7} className="text-center text-gray-400 py-8">{t("employees.noEmployees")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
