import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.salaryAdvance.deleteMany({});
  await prisma.employeePayroll.deleteMany({});
  await prisma.payrollRecord.deleteMany({});
  await prisma.payrollRun.deleteMany({});
  await prisma.employee.deleteMany({});

  const company = await prisma.company.upsert({
    where: { slug: "demo-company" },
    update: {},
    create: { name: "Société Démo", slug: "demo-company" },
  });

  const password = await hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      name: "Admin Test",
      password,
      role: "ADMIN",
      companyId: company.id,
    },
  });

  console.log("Base de données initialisée avec succès");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => { prisma.$disconnect(); pool.end(); });
