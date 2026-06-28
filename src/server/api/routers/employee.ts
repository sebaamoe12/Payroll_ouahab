import { z } from "zod";
import { router, protectedProcedure } from "@/server/api/middleware";

const employeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  position: z.string().min(1).max(200),
  baseSalary: z.number().positive(),
  startDate: z.string().datetime(),
  phone: z.string().optional().or(z.literal("")),
  monthlyAdvanceLimit: z.number().positive().optional(),
  payDay: z.number().int().min(1).max(31).optional(),
});

export const employeeRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.employee.findMany({
      where: { company: { users: { some: { id: ctx.userId } } } },
      include: {
        payrollRecords: { select: { netSalary: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),
  byId: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.employee.findFirst({
      where: { id: input, company: { users: { some: { id: ctx.userId } } } },
      include: { advances: true, payrollRecords: true },
    });
  }),
  create: protectedProcedure.input(employeeSchema).mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!user) throw new Error("Utilisateur non trouvé");
    return ctx.prisma.employee.create({
      data: {
        ...input,
        baseSalary: input.baseSalary,
        monthlyAdvanceLimit: input.monthlyAdvanceLimit ?? input.baseSalary,
        companyId: user.companyId,
      },
    });
  }),
  update: protectedProcedure
    .input(z.object({ id: z.string(), data: employeeSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.employee.update({
        where: { id: input.id },
        data: { ...input.data },
      });
    }),
  toggleStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.enum(["ACTIVE", "INACTIVE"]) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.employee.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),
});
