import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/middleware";

export const payrollRouter = router({
  listRuns: protectedProcedure
    .input(z.object({ employeeId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        company: { users: { some: { id: ctx.userId } } },
      };
      if (input?.employeeId) {
        where.records = { some: { employeeId: input.employeeId } };
      }
      return ctx.prisma.payrollRun.findMany({
        where,
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        include: {
          records: {
            include: {
              employee: { select: { firstName: true, lastName: true, position: true, payDay: true } },
              appliedAdvances: true,
            },
          },
        },
      });
    }),
  getRun: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.payrollRun.findFirst({
      where: { id: input },
      include: {
        records: {
          include: {
            employee: { select: { firstName: true, lastName: true, position: true, payDay: true } },
            appliedAdvances: true,
          },
        },
      },
    });
  }),
  createRun: protectedProcedure
    .input(
      z.object({
        periodMonth: z.number().min(1).max(12),
        periodYear: z.number(),
        employeeIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
      if (!user) throw new Error("Utilisateur non trouvé");

      const whereEmployees: Record<string, unknown> = {
        companyId: user.companyId,
        status: "ACTIVE",
      };
      if (input.employeeIds && input.employeeIds.length > 0) {
        whereEmployees.id = { in: input.employeeIds };
      }

      const employees = await ctx.prisma.employee.findMany({
        where: whereEmployees,
        include: {
          advances: {
            where: { status: { in: ["APPROVED"] }, appliedInPayrollId: null },
          },
        },
      });

      if (employees.length === 0) throw new Error("Aucun employé actif trouvé");

      const recordsData = employees.map((emp) => {
        const totalAdvances = emp.advances.reduce((sum, a) => sum + Number(a.amount), 0);
        const netSalary = Number(emp.baseSalary) - totalAdvances;
        return {
          employeeId: emp.id,
          baseSalary: emp.baseSalary,
          totalAdvances,
          netSalary: Math.max(netSalary, 0),
          deductions: 0,
          advanceIds: emp.advances.map((a) => a.id),
        };
      });

      const totalAmount = recordsData.reduce((sum, r) => sum + Number(r.netSalary), 0);

      const run = await ctx.prisma.payrollRun.create({
        data: {
          companyId: user.companyId,
          periodMonth: input.periodMonth,
          periodYear: input.periodYear,
          processedBy: ctx.userId,
          totalAmount,
          records: {
            create: recordsData.map((r) => ({
              employeeId: r.employeeId,
              baseSalary: r.baseSalary,
              totalAdvances: r.totalAdvances,
              netSalary: r.netSalary,
              deductions: r.deductions,
            })),
          },
        },
        include: { records: true },
      });

      for (const rec of recordsData) {
        if (rec.advanceIds.length > 0) {
          const record = run.records.find((r) => r.employeeId === rec.employeeId);
          if (record) {
            await ctx.prisma.salaryAdvance.updateMany({
              where: { id: { in: rec.advanceIds } },
              data: { appliedInPayrollId: record.id },
            });
          }
        }
      }

      return ctx.prisma.payrollRun.findUnique({
        where: { id: run.id },
        include: {
          records: {
            include: {
              employee: { select: { firstName: true, lastName: true, position: true, payDay: true } },
              appliedAdvances: true,
            },
          },
        },
      });
    }),
  approveRun: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.payrollRun.update({
      where: { id: input },
      data: { status: "APPROVED" },
    });
  }),
  payRun: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const run = await ctx.prisma.payrollRun.findUnique({
      where: { id: input },
      include: { records: { include: { appliedAdvances: true } } },
    });
    if (!run) throw new Error("Paie non trouvée");
    if (run.status !== "APPROVED") throw new Error("La paie doit être approuvée d'abord");

    const advanceIds = run.records.flatMap((r) => r.appliedAdvances.map((a) => a.id));

    if (advanceIds.length > 0) {
      await ctx.prisma.salaryAdvance.updateMany({
        where: { id: { in: advanceIds } },
        data: { status: "PAID" },
      });
    }

    return ctx.prisma.payrollRun.update({
      where: { id: input },
      data: { status: "PAID" },
    });
  }),
  deleteRun: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const run = await ctx.prisma.payrollRun.findUnique({ where: { id: input } });
    if (!run) throw new Error("Paie non trouvée");
    if (run.status !== "DRAFT") throw new Error("Seules les paies en brouillon peuvent être supprimées");

    const records = await ctx.prisma.payrollRecord.findMany({
      where: { payrollRunId: input },
      include: { appliedAdvances: { select: { id: true } } },
    });

    const advanceIds = records.flatMap((r) => r.appliedAdvances.map((a) => a.id));

    if (advanceIds.length > 0) {
      await ctx.prisma.salaryAdvance.updateMany({
        where: { id: { in: advanceIds } },
        data: { appliedInPayrollId: null },
      });
    }

    await ctx.prisma.payrollRecord.deleteMany({ where: { payrollRunId: input } });
    await ctx.prisma.payrollRun.delete({ where: { id: input } });
    return { success: true };
  }),
});
