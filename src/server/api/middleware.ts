import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

export async function createTRPCContext(opts: { req: Request }) {
  const session = await auth();
  return {
    session,
    prisma,
    ...opts,
  };
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { userId: ctx.session.user.id },
  });
});

const enforceAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { userId: ctx.session.user.id },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(enforceAuth);
export const adminProcedure = t.procedure.use(enforceAdmin);
