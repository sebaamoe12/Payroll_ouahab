import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/middleware";

function* monthsBetween(startMonth: number, startYear: number, endMonth: number, endYear: number) {
  let m = startMonth;
  let y = startYear;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    yield { month: m, year: y };
    m++;
    if (m > 12) { m = 1; y++; }
  }
}

export const employeePayrollRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const employees = await ctx.prisma.employee.findMany({
      where: { company: { users: { some: { id: ctx.userId } } } },
    });

    const allPayrolls = await ctx.prisma.employeePayroll.findMany({
      where: {
        company: { users: { some: { id: ctx.userId } } },
      },
    });
    const payrollMap = new Map<string, typeof allPayrolls[0]>();
    for (const p of allPayrolls) {
      payrollMap.set(`${p.employeeId}_${p.periodMonth}_${p.periodYear}`, p);
    }

    const empIds = employees.map((e) => e.id);
    // Only fetch advances NOT already linked to a payroll
    const allAdvances = await ctx.prisma.salaryAdvance.findMany({
      where: {
        employeeId: { in: empIds },
        status: { in: ["APPROVED", "PAID"] },
        appliedInEmployeePayrollId: null,
      },
    });
    const advancesByEmployee = new Map<string, typeof allAdvances>();
    for (const a of allAdvances) {
      const key = a.employeeId;
      if (!advancesByEmployee.has(key)) advancesByEmployee.set(key, []);
      advancesByEmployee.get(key)!.push(a);
    }

    type MonthEntry = {
      month: number;
      year: number;
      baseSalary: number;
      totalAdvances: number;
      netSalary: number;
      status: "PENDING" | "PAID" | "NOT_DUE";
      payrollId: string | null;
    };

    type EmployeeEntries = {
      employeeId: string;
      employeeName: string;
      employeePosition: string;
      payDay: number;
      startDate: string;
      months: MonthEntry[];
    };

    const items: EmployeeEntries[] = [];

    for (const emp of employees) {
      const startMonth = emp.startDate.getMonth() + 1;
      const startYear = emp.startDate.getFullYear();
      const empAdvances = advancesByEmployee.get(emp.id) ?? [];
      const months: MonthEntry[] = [];

      for (const { month, year } of monthsBetween(startMonth, startYear, currentMonth, currentYear)) {
        const key = `${emp.id}_${month}_${year}`;
        const payroll = payrollMap.get(key);

        // Advances for this specific month (only unlinked advances)
        const monthAdvances = empAdvances
          .filter((a) => {
            const am = a.date.getMonth() + 1;
            const ay = a.date.getFullYear();
            return am === month && ay === year;
          })
          .reduce((s, a) => s + Number(a.amount), 0);

        if (payroll) {
          months.push({
            month, year,
            baseSalary: Number(payroll.baseSalary),
            totalAdvances: Number(payroll.totalAdvances),
            netSalary: Number(payroll.netSalary),
            status: payroll.status === "PAID" ? "PAID" : "PENDING",
            payrollId: payroll.id,
          });
        } else if (month === currentMonth && year === currentYear && emp.payDay > currentDay) {
          months.push({
            month, year,
            baseSalary: Number(emp.baseSalary),
            totalAdvances: monthAdvances,
            netSalary: Math.max(Number(emp.baseSalary) - monthAdvances, 0),
            status: "NOT_DUE",
            payrollId: null,
          });
        } else {
          months.push({
            month, year,
            baseSalary: Number(emp.baseSalary),
            totalAdvances: monthAdvances,
            netSalary: Math.max(Number(emp.baseSalary) - monthAdvances, 0),
            status: "PENDING",
            payrollId: null,
          });
        }
      }

      items.push({
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeePosition: emp.position,
        payDay: emp.payDay,
        startDate: emp.startDate.toISOString(),
        months,
      });
    }

    const totalPendingAmount = items.reduce(
      (s, emp) => s + emp.months.filter((m) => m.status === "PENDING").reduce((ms, m) => ms + m.netSalary, 0),
      0
    );

    return { items, totalPendingAmount };
  }),

  pay: protectedProcedure
    .input(z.object({ employeeId: z.string(), periodMonth: z.number(), periodYear: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const emp = await ctx.prisma.employee.findUnique({
        where: { id: input.employeeId },
        include: {
          advances: {
            where: {
              status: { in: ["APPROVED", "PAID"] },
              appliedInEmployeePayrollId: null,
              date: {
                gte: new Date(input.periodYear, input.periodMonth - 1, 1),
                lt: new Date(input.periodYear, input.periodMonth, 1),
              },
            },
          },
        },
      });
      if (!emp) throw new Error("Employé non trouvé");

      const totalAdvances = emp.advances.reduce((s, a) => s + Number(a.amount), 0);
      const netSalary = Math.max(Number(emp.baseSalary) - totalAdvances, 0);

      const existing = await ctx.prisma.employeePayroll.findUnique({
        where: { employeeId_periodMonth_periodYear: { employeeId: input.employeeId, periodMonth: input.periodMonth, periodYear: input.periodYear } },
      });

      let payroll;
      if (existing) {
        payroll = await ctx.prisma.employeePayroll.update({
          where: { id: existing.id },
          data: { status: "PAID", paidById: ctx.userId, paidAt: new Date(), totalAdvances, netSalary },
        });
      } else {
        payroll = await ctx.prisma.employeePayroll.create({
          data: {
            employeeId: input.employeeId,
            companyId: emp.companyId,
            periodMonth: input.periodMonth,
            periodYear: input.periodYear,
            baseSalary: emp.baseSalary,
            totalAdvances,
            netSalary,
            status: "PAID",
            paidById: ctx.userId,
            paidAt: new Date(),
          },
        });
      }

      // Link advances to this payroll
      if (emp.advances.length > 0) {
        await ctx.prisma.salaryAdvance.updateMany({
          where: { id: { in: emp.advances.map((a) => a.id) } },
          data: { appliedInEmployeePayrollId: payroll.id },
        });
      }

      return payroll;
    }),

  payAll: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const employees = await ctx.prisma.employee.findMany({
      where: { company: { users: { some: { id: ctx.userId } } }, status: "ACTIVE" },
    });

    const existingPayrolls = await ctx.prisma.employeePayroll.findMany({
      where: {
        company: { users: { some: { id: ctx.userId } } },
        employee: { status: "ACTIVE" },
      },
    });
    const payrollSet = new Set(existingPayrolls.map((p) => `${p.employeeId}_${p.periodMonth}_${p.periodYear}`));

    const empIds = employees.map((e) => e.id);
    const allAdvances = await ctx.prisma.salaryAdvance.findMany({
      where: {
        employeeId: { in: empIds },
        status: { in: ["APPROVED", "PAID"] },
        appliedInEmployeePayrollId: null,
      },
    });

    const results: Array<{ employeeId: string; periodMonth: number; periodYear: number; netSalary: number }> = [];

    for (const emp of employees) {
      const startMonth = emp.startDate.getMonth() + 1;
      const startYear = emp.startDate.getFullYear();

      for (const { month, year } of monthsBetween(startMonth, startYear, currentMonth, currentYear)) {
        const key = `${emp.id}_${month}_${year}`;
        if (payrollSet.has(key)) continue;

        // Skip if current month and pay day hasn't arrived
        if (month === currentMonth && year === currentYear && emp.payDay > currentDay) continue;

        const monthAdvances = allAdvances
          .filter((a) => a.employeeId === emp.id && a.date.getMonth() + 1 === month && a.date.getFullYear() === year)
          .reduce((s, a) => s + Number(a.amount), 0);

        const netSalary = Math.max(Number(emp.baseSalary) - monthAdvances, 0);

        const payroll = await ctx.prisma.employeePayroll.create({
          data: {
            employeeId: emp.id,
            companyId: emp.companyId,
            periodMonth: month,
            periodYear: year,
            baseSalary: emp.baseSalary,
            totalAdvances: monthAdvances,
            netSalary,
            status: "PAID",
            paidById: ctx.userId,
            paidAt: new Date(),
          },
        });

        // Link advances to this payroll
        const advancesToLink = allAdvances.filter(
          (a) => a.employeeId === emp.id && a.date.getMonth() + 1 === month && a.date.getFullYear() === year
        );
        if (advancesToLink.length > 0) {
          await ctx.prisma.salaryAdvance.updateMany({
            where: { id: { in: advancesToLink.map((a) => a.id) } },
            data: { appliedInEmployeePayrollId: payroll.id },
          });
        }

        results.push({ employeeId: emp.id, periodMonth: month, periodYear: year, netSalary });
      }
    }

    return { paid: results.length, total: results.reduce((s, r) => s + r.netSalary, 0) };
  }),

  payEmployeeAll: protectedProcedure
    .input(z.object({ employeeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentDay = now.getDate();

      const emp = await ctx.prisma.employee.findUnique({
        where: { id: input.employeeId },
      });
      if (!emp) throw new Error("Employé non trouvé");

      const existingPayrolls = await ctx.prisma.employeePayroll.findMany({
        where: { employeeId: emp.id },
      });
      const payrollSet = new Set(existingPayrolls.map((p) => `${p.periodMonth}_${p.periodYear}`));

      const allAdvances = await ctx.prisma.salaryAdvance.findMany({
        where: {
          employeeId: emp.id,
          status: { in: ["APPROVED", "PAID"] },
          appliedInEmployeePayrollId: null,
        },
      });

      const startMonth = emp.startDate.getMonth() + 1;
      const startYear = emp.startDate.getFullYear();
      const results: Array<{ periodMonth: number; periodYear: number; netSalary: number }> = [];

      for (const { month, year } of monthsBetween(startMonth, startYear, currentMonth, currentYear)) {
        const key = `${month}_${year}`;
        if (payrollSet.has(key)) continue;
        if (month === currentMonth && year === currentYear && emp.payDay > currentDay) continue;

        const monthAdvances = allAdvances
          .filter((a) => a.date.getMonth() + 1 === month && a.date.getFullYear() === year)
          .reduce((s, a) => s + Number(a.amount), 0);

        const netSalary = Math.max(Number(emp.baseSalary) - monthAdvances, 0);

        const payroll = await ctx.prisma.employeePayroll.create({
          data: {
            employeeId: emp.id,
            companyId: emp.companyId,
            periodMonth: month,
            periodYear: year,
            baseSalary: emp.baseSalary,
            totalAdvances: monthAdvances,
            netSalary,
            status: "PAID",
            paidById: ctx.userId,
            paidAt: new Date(),
          },
        });

        const advancesToLink = allAdvances.filter(
          (a) => a.date.getMonth() + 1 === month && a.date.getFullYear() === year
        );
        if (advancesToLink.length > 0) {
          await ctx.prisma.salaryAdvance.updateMany({
            where: { id: { in: advancesToLink.map((a) => a.id) } },
            data: { appliedInEmployeePayrollId: payroll.id },
          });
        }

        results.push({ periodMonth: month, periodYear: year, netSalary });
      }

      return { paid: results.length, total: results.reduce((s, r) => s + r.netSalary, 0) };
    }),

  listAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.employeePayroll.findMany({
      where: { company: { users: { some: { id: ctx.userId } } } },
      include: { employee: { select: { firstName: true, lastName: true, position: true, payDay: true } } },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { createdAt: "desc" }],
    });
  }),
});
