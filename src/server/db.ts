import "server-only";

import { PrismaClient, type Prisma } from "@prisma/client";

/**
 * One PrismaClient per process. In development Next.js hot-reloads modules, so the
 * client is parked on globalThis to avoid exhausting Postgres connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Transaction client type, for helpers that run inside db.$transaction(). */
export type Tx = Prisma.TransactionClient;
