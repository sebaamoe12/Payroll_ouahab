import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/middleware";

export const reportRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const employees = await ctx.prisma.employee.findMany({
      where: { company: { users: { some: { id: ctx.userId } } } },
    });
    const totalEmployees = employees.length;

    const latestPayrolls = await ctx.prisma.employeePayroll.findMany({
      where: {
        company: { users: { some: { id: ctx.userId } } },
        status: "PAID",
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
    const totalPayroll = latestPayrolls.reduce((s, p) => s + Number(p.netSalary), 0);

    return { totalEmployees, totalPayroll };
  }),

  employeeHistory: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.employeePayroll.findMany({
      where: {
        employeeId: input,
        company: { users: { some: { id: ctx.userId } } },
      },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
  }),

  monthlyOverview: protectedProcedure.query(async ({ ctx }) => {
    const allPayrolls = await ctx.prisma.employeePayroll.findMany({
      where: { company: { users: { some: { id: ctx.userId } } } },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });

    const grouped = new Map<string, { month: number; year: number; total: number; employees: number; paid: number; pending: number }>();
    for (const p of allPayrolls) {
      const key = `${p.periodYear}_${p.periodMonth}`;
      const g = grouped.get(key) ?? { month: p.periodMonth, year: p.periodYear, total: 0, employees: 0, paid: 0, pending: 0 };
      g.total += Number(p.netSalary);
      g.employees++;
      if (p.status === "PAID") g.paid++;
      else g.pending++;
      grouped.set(key, g);
    }

    return Array.from(grouped.values()).sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  }),
});
