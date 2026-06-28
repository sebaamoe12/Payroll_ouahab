# PROJECT MAP — Gestion Paie SaaS

## Stack
- **Frontend**: Next.js 16 (App Router), Tailwind CSS 4, next-intl, tRPC 11 React Query, Recharts
- **Backend**: Next.js API Routes, tRPC 11 Server, Prisma 7 ORM, PostgreSQL 16
- **Auth**: next-auth v4 (Credentials/JWT)
- **Infrastructure**: Docker Compose (PostgreSQL), pnpm

## Architecture

```
src/
├── app/
│   ├── layout.tsx              ← Root layout (providers chain)
│   ├── globals.css             ← Tailwind + custom theme
│   ├── page.tsx                ← Landing page
│   ├── login/                  ← Login page
│   ├── register/               ← Registration page
│   ├── dashboard/
│   │   ├── layout.tsx          ← Sidebar + main area
│   │   ├── page.tsx            ← Home / summary cards
│   │   ├── employees/page.tsx  ← Employee CRUD
│   │   ├── advances/page.tsx   ← Salary advances
│   │   ├── payroll/page.tsx    ← Per-employee payroll
│   │   └── reports/page.tsx    ← Financial reports
│   └── api/
│       ├── auth/[...nextauth]  ← NextAuth handler
│       ├── register/route.ts   ← Registration endpoint
│       └── trpc/[trpc]/route.ts← tRPC HTTP handler
├── components/
│   ├── TRPCProvider.tsx         ← tRPC + React Query client
│   ├── SessionProvider.tsx     ← NextAuth client provider
│   ├── forms/                  ← Form components (placeholder)
│   └── ui/                     ← UI primitives (placeholder)
├── server/
│   ├── db/index.ts             ← PrismaClient singleton
│   ├── auth/index.ts           ← NextAuth config
│   └── api/
│       ├── middleware.ts        ← tRPC context + auth middleware
│       └── routers/
│           ├── index.ts         ← Router aggregation
│           ├── employee.ts      ← Employee CRUD
│           ├── advance.ts       ← Salary advances with status workflow
│           ├── payroll.ts       ← OLD group payroll router (deprecated)
│           ├── report.ts        ← Reports
│           └── employeePayroll.ts ← NEW per-employee payroll router
├── shared/types.ts             ← AppRouter type re-export
└── generated/prisma/           ← Prisma Client (auto-generated)
```

## Schema (9 models)

| Model | Key Relations | Status |
|---|---|---|
| Company | users, employees, payrollRuns, payrolls | ✅ |
| User | company, accounts, sessions | ✅ |
| Employee | company, advances, payrollRecords, payrolls | ✅ |
| SalaryAdvance | employee, approvedBy, appliedInRecord | ✅ |
| PayrollRun | company, records | 🟡 Legacy (not in active UI) |
| PayrollRecord | payrollRun, employee, appliedAdvances | 🟡 Legacy |
| EmployeePayroll | employee, company, paidBy | ✅ Active |
| Account | user | ✅ |
| Session | user | ✅ |
| VerificationToken | — | ✅ |

## Routers & Procedures

### employeeRouter
- `list` → all employees for user's company (includes payrollRecords for total payout)
- `byId` → single employee with advances + payrollRecords
- `create` → new employee (defaults monthlyAdvanceLimit = baseSalary)
- `update` → partial update
- `toggleStatus` → ACTIVE/INACTIVE

### advanceRouter
- `list` → filterable by status/employee, includes employee + approvedBy
- `byEmployee` → all advances for one employee
- `create` → validates monthly limit, excludes advances linked to either payroll system
- `update` → blocks if appliedInPayrollId **or** appliedInEmployeePayrollId
- `delete` → blocks if appliedInPayrollId **or** appliedInEmployeePayrollId
- `approve` → sets APPROVED + approvedById + approvedAt
- `reject` → sets REJECTED
- `markPaid` → sets PAID

### employeePayrollRouter (Active)
- `overview` → ALL months since employee startDate → now, per-month: baseSalary, advances deducted, netSalary, status (PAID/PENDING/NOT_DUE). Only unlinked advances are counted. Returns `totalPendingAmount` summary.
- `pay` → creates/updates EmployeePayroll record with PAID status, deducts month's unlinked advances, **links them via `appliedInEmployeePayrollId`**
- `payAll` → bulk-pays ALL pending months for ALL employees at once, linking advances
- `payEmployeeAll` → bulk-pays all pending months for a single employee
- `listAll` → full history of all paid/pending payroll records

### payrollRouter (Legacy - preserved, not in UI)
- `listRuns`, `getRun`, `createRun`, `approveRun`, `payRun`, `deleteRun`

### reportRouter
- `summary` → total active employees + sum of all paid EmployeePayroll net salaries
- `employeeHistory` → all EmployeePayroll records for one employee
- `monthlyOverview` → grouped by (year, month) with totals, paid/pending counts

## State Machine

### Advance Status Flow
```
PENDING → APPROVED → PAID
  ↓          ↓
 REJECTED   [appliedInPayrollId OR appliedInEmployeePayrollId blocks edit/delete]
```
Validation: sum of PENDING + APPROVED advances (excluding those linked to any payroll) ≤ monthlyAdvanceLimit (defaults to baseSalary)

### Advance-Payroll Linkage
When an employee's payroll is paid for a month:
1. All APPROVED/PAID advances in that month (with no existing linkage) are collected
2. Their `appliedInEmployeePayrollId` is set to the EmployeePayroll record ID
3. Linked advances are immutable (edit/delete blocked) and excluded from future month computations
4. This prevents double-deduction of the same advance across months

### Employee Payroll Status
```
NOT_DUE (pay day not yet reached) → PENDING → PAID
```
- NOT_DUE only computed for current month if pay day hasn't passed
- All past months start as PENDING automatically
- Advances are auto-deducted from the month they were created

## Milestones & UI Coverage

| Milestone | Description | Pages | Status |
|---|---|---|---|
| M1 | Auth, Employee CRUD, Schema | /login, /register, /dashboard, /dashboard/employees | ✅ |
| M2 | Salary Advances (full workflow) | /dashboard/advances | ✅ |
| M3 | Per-employee Payroll (auto-deduct, all months) | /dashboard/payroll | ✅ |
| M4 | Reports & Dashboard Summary | /dashboard/reports, /dashboard | ✅ |
| M5 | Stripe Billing & Subscription | TBD | 🟡 PENDING |
| M6 | Email Notifications (Resend) | TBD | 🟡 PENDING |
| M7 | Tests & Polish | TBD | 🟡 PENDING |

## Completed Refinements (Sprint 2)
- [x] Reports page rewritten to use `EmployeePayroll.monthlyOverview` (grouped by month)
- [x] `report.summary` reads from `EmployeePayroll` (sum of paid net salaries)
- [x] `report.companyOverview` replaced with `report.monthlyOverview`
- [x] Employee create form includes `payDay` (validated 1-31)
- [x] Employee table shows pay day column (badge-blue)
- [x] Toast notifications for all mutations (success/error) via `ToastProvider`
- [x] Loading/disabled states on all mutation buttons
- [x] All i18n missing keys resolved (`draft`, `approved`, `totalEmployees`)
- [x] **Advance-Payroll FK linkage**: `appliedInEmployeePayrollId` on `SalaryAdvance` — linked advances immutable, excluded from future computations
- [x] **`payAll` mutation**: bulk-pays all pending months for all employees at once, with advance linkage
- [x] **"Tout payer" button** in payroll page header (shows pending count, disabled when none)
- [x] **Schema migration**: `EmployeePayroll.appliedAdvances` inverse relation added

## ORPHANS & PENDING

### Fixed (recently resolved)
- [x] `payroll.draft` missing from fr.json → Added
- [x] `payroll.approved` missing from fr.json → Added
- [x] `payroll.totalEmployees` missing from fr.json → Added
- [x] Implicit `any` types → Casted to `any`
- [x] `company` relation filter on SalaryAdvance → Changed to `employeeId: { in: empIds }`
- [x] Reports page now uses `EmployeePayroll` data, not old `PayrollRun`
- [x] `report` router updated: `summary` reads `EmployeePayroll`, new `monthlyOverview` procedure
- [x] Employee create form includes `payDay` field (1-31 with validation)
- [x] Employee table shows pay day badge
- [x] Toast notification system (`ToastProvider` + `useToast`) for all mutations
- [x] Loading states (`disabled`) on all mutation buttons

### Orphan Code
- `payrollRouter` (old group payroll) → preserved but NOT connected to any UI page
- `forms/` and `ui/` component dirs → mostly empty (toast lives in `ui/`)
- `date-fns` in deps → not used
- `prettier` not configured

### Missing Features (M5+)
- [ ] Stripe billing integration (M5)
- [ ] Email notifications on advance approval/payroll payment (resend installed)
- [ ] Tests (unit/integration)
- [ ] Dashboard chart (recharts is installed but not used)
- [ ] Seed demo data (advances + payroll records)
- [ ] Role-based access enforcement (ADMIN/MANAGER/VIEWER)
- [ ] Employee edit form (currently only create + toggle status)
- [ ] Pagination for advances table (long lists)

## Key Decisions

1. **Per-employee Payroll**: New `EmployeePayroll` model replaces old `PayrollRun` system. One record per employee per month with `@@unique([employeeId, periodMonth, periodYear])`.
2. **Advance Deduction**: Advances are deducted from the month they were created in, by filtering `date` field to that month range. When payroll is paid, advances are **linked via FK** (`appliedInEmployeePayrollId`) — this prevents double-deduction and makes linked advances immutable.
3. **Remaining balance**: Advances page shows `baseSalary - activeAdvances` per employee, where active advances exclude those linked to any payroll system.
4. **Pay Day Logic**: Employee `payDay` Int (1-31) determines when each month's payroll is due. Past months with no paid record = PENDING. Current month before pay day = NOT_DUE.
5. **French Only**: Single-locale app, no middleware for i18n, static import of `fr.json`.
6. **Prisma 7**: Uses `@prisma/adapter-pg` with `pg` Pool. Output to `src/generated/prisma`.

## Auth Flow
- Credentials-based (email/password) with JWT sessions
- Registration creates Company + User simultaneously
- Every query scoped to `company: { users: { some: { id: ctx.userId } } }`
- Two roles exist in schema (ADMIN, MANAGER, VIEWER) but not enforced yet

## Seed
- `prisma/seed.ts` → creates 1 company + 1 admin user (`admin@demo.com`/`admin123`)
- No demo employees, advances, or payroll records
- Run with: `pnpm db:seed`
