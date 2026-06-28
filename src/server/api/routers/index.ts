import { router } from "@/server/api/middleware";
import { employeeRouter } from "./employee";
import { advanceRouter } from "./advance";
import { payrollRouter } from "./payroll";
import { reportRouter } from "./report";
import { employeePayrollRouter } from "./employeePayroll";

export const appRouter = router({
  employee: employeeRouter,
  advance: advanceRouter,
  payroll: payrollRouter,
  report: reportRouter,
  employeePayroll: employeePayrollRouter,
});

export type AppRouter = typeof appRouter;
