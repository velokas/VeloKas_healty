import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getAdapterConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL belum disetel.");

  const url = new URL(databaseUrl);
  const sslAccept = url.searchParams.get("sslaccept")?.toLowerCase();
  const rejectUnauthorized = sslAccept !== "accept_invalid_certs";
  const useTls = sslAccept === "strict" || /tidbcloud\.com/i.test(url.hostname);
  const configuredLimit = Number(process.env.DB_CONNECTION_LIMIT ?? 3);
  const connectionLimit = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? Math.min(configuredLimit, 5)
    : 3;

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit,
    connectTimeout: 5_000,
    idleTimeout: 240,
    ...(useTls ? { ssl: { rejectUnauthorized } } : {}),
  };
}

function createPrismaClient() {
  const adapter = new PrismaMariaDb(getAdapterConfig());
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
