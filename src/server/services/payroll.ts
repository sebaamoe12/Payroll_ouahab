import { prisma } from "@/server/db";

export async function calculatePayroll(
  companyId: string,
  month: number,
  year: number,
  processedBy: string
) {
  const employees = await prisma.employee.findMany({
    where: { companyId, status: "ACTIVE" },
    include: {
      advances: {
        where: { appliedInPayrollId: null },
      },
    },
  });

  if (employees.length === 0) {
    throw new Error("No active employees found");
  }

  const run = await prisma.payrollRun.create({
    data: {
      companyId,
      periodMonth: month,
      periodYear: year,
      processedBy,
      records: {
        create: employees.map((emp) => {
          const totalAdvances = emp.advances.reduce(
            (sum, a) => sum + Number(a.amount),
            0
          );
          const netSalary = Math.max(Number(emp.baseSalary) - totalAdvances, 0);
          return {
            employeeId: emp.id,
            baseSalary: emp.baseSalary,
            totalAdvances,
            netSalary,
            deductions: 0,
          };
        }),
      },
    },
    include: { records: true },
  });

  return run;
}
