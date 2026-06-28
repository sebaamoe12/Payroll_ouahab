import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/middleware";

const advanceTypeEnum = z.enum(["SALARY", "EMERGENCY", "MEDICAL", "OTHER"]);
const advanceStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]);

export const advanceRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: advanceStatusEnum.optional(),
          employeeId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { companyId: true },
      });
      if (!user) return [];

      const where: Record<string, unknown> = { companyId: user.companyId };
      if (input?.status) where.status = input.status;
      if (input?.employeeId) where.employeeId = input.employeeId;

      return ctx.prisma.salaryAdvance.findMany({
        where,
        include: {
          employee: { select: { firstName: true, lastName: true, monthlyAdvanceLimit: true } },
          approvedBy: { select: { name: true } },
        },
        orderBy: { date: "desc" },
      });
    }),
  byEmployee: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.salaryAdvance.findMany({
      where: { employeeId: input },
      include: { approvedBy: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
  }),
  create: protectedProcedure
    .input(
      z.object({
        employeeId: z.string(),
        amount: z.number().positive(),
        type: advanceTypeEnum.optional().default("SALARY"),
        reason: z.string().optional(),
        date: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const employee = await ctx.prisma.employee.findUnique({
        where: { id: input.employeeId },
        include: {
          advances: {
            where: {
              status: { in: ["PENDING", "APPROVED"] },
              appliedInPayrollId: null,
              appliedInEmployeePayrollId: null,
            },
          },
        },
      });
      if (!employee) throw new Error("Employé non trouvé");

      const usedAdvance = employee.advances.reduce(
        (sum, a) => sum + Number(a.amount),
        0
      );
      const limit = Number(employee.monthlyAdvanceLimit);
      if (usedAdvance + input.amount > limit) {
        throw new Error(
          `Limite d'avance mensuelle dépassée. Maximum: ${limit} DZD, disponible: ${limit - usedAdvance} DZD`
        );
      }

      return ctx.prisma.salaryAdvance.create({
        data: {
          employeeId: input.employeeId,
          amount: input.amount,
          reason: input.reason,
          type: input.type,
          date: input.date ? new Date(input.date) : new Date(),
          companyId: employee.companyId,
        },
      });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          amount: z.number().positive().optional(),
          reason: z.string().optional(),
          type: advanceTypeEnum.optional(),
          status: advanceStatusEnum.optional(),
          date: z.string().datetime().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const advance = await ctx.prisma.salaryAdvance.findUnique({
        where: { id: input.id },
      });
      if (!advance) throw new Error("Avance non trouvée");
      if (advance.appliedInPayrollId || advance.appliedInEmployeePayrollId) throw new Error("Impossible de modifier une avance appliquée à la paie");

      const updateData: Record<string, unknown> = {};
      if (input.data.amount !== undefined) updateData.amount = input.data.amount;
      if (input.data.reason !== undefined) updateData.reason = input.data.reason;
      if (input.data.type !== undefined) updateData.type = input.data.type;
      if (input.data.date !== undefined) updateData.date = new Date(input.data.date);

      if (input.data.status === "APPROVED") {
        updateData.approvedById = ctx.userId;
        updateData.approvedAt = new Date();
      }
      if (input.data.status !== undefined) updateData.status = input.data.status;

      return ctx.prisma.salaryAdvance.update({
        where: { id: input.id },
        data: updateData,
      });
    }),
  delete: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const advance = await ctx.prisma.salaryAdvance.findUnique({
      where: { id: input },
    });
    if (!advance) throw new Error("Avance non trouvée");
    if (advance.appliedInPayrollId || advance.appliedInEmployeePayrollId) throw new Error("Impossible de supprimer une avance appliquée à la paie");
    return ctx.prisma.salaryAdvance.delete({ where: { id: input } });
  }),
  approve: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.salaryAdvance.update({
      where: { id: input },
      data: { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date() },
    });
  }),
  reject: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.salaryAdvance.update({
      where: { id: input },
      data: { status: "REJECTED", approvedById: ctx.userId, approvedAt: new Date() },
    });
  }),
  markPaid: protectedProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.salaryAdvance.update({
      where: { id: input },
      data: { status: "PAID" },
    });
  }),
});
