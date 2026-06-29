import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? "",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
