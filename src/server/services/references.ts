import "server-only";

import type { Tx } from "../db";

/**
 * Human-readable, gap-free references using a row-locked counter per year:
 *   projects → RET-2026-0042, orders → ORD-2026-000123
 */
async function next(tx: Tx, key: string) {
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

export async function nextProjectReference(tx: Tx, now = new Date()) {
  const year = now.getUTCFullYear();
  const value = await next(tx, `project-${year}`);
  return `RET-${year}-${String(value).padStart(4, "0")}`;
}

export async function nextOrderReference(tx: Tx, now = new Date()) {
  const year = now.getUTCFullYear();
  const value = await next(tx, `order-${year}`);
  return `ORD-${year}-${String(value).padStart(6, "0")}`;
}

export async function nextInvoiceNumber(tx: Tx, now = new Date()) {
  const year = now.getUTCFullYear();
  const value = await next(tx, `invoice-${year}`);
  return `INV-${year}-${String(value).padStart(5, "0")}`;
}
