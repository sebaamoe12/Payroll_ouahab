import { Prisma } from "@/generated/prisma/client";

export function toNumber(value: Prisma.Decimal | number | string): number {
  return Number(value);
}

export function sumDecimals(values: (Prisma.Decimal | number)[]): number {
  return values.reduce<number>((sum, v) => sum + Number(v), 0);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
  }).format(value);
}
