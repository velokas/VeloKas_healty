import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  schemaReady: Promise<void> | undefined;
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

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (prop === "then") return undefined;
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

const schemaStatements = [
  {
    table: "User",
    sql: `CREATE TABLE IF NOT EXISTS \`User\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`email\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NULL,
      \`bio\` VARCHAR(191) NULL,
      \`club\` VARCHAR(191) NOT NULL DEFAULT 'Downtown Club',
      \`avatar\` LONGTEXT NULL,
      \`passwordHash\` VARCHAR(191) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`User_email_key\` (\`email\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  {
    table: "Photo",
    sql: `CREATE TABLE IF NOT EXISTS \`Photo\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`caption\` VARCHAR(191) NULL,
      \`likes\` INTEGER NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      KEY \`Photo_userId_idx\` (\`userId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  {
    table: "PhotoImage",
    sql: `CREATE TABLE IF NOT EXISTS \`PhotoImage\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`photoId\` VARCHAR(191) NOT NULL,
      \`url\` LONGTEXT NOT NULL,
      \`order\` INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      KEY \`PhotoImage_photoId_idx\` (\`photoId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  {
    table: "Story",
    sql: `CREATE TABLE IF NOT EXISTS \`Story\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`mediaUrl\` LONGTEXT NOT NULL,
      \`caption\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      KEY \`Story_userId_idx\` (\`userId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
  {
    table: "CommunityPost",
    sql: `CREATE TABLE IF NOT EXISTS \`CommunityPost\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`category\` VARCHAR(191) NOT NULL,
      \`imageUrl\` LONGTEXT NOT NULL,
      \`caption\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      KEY \`CommunityPost_userId_idx\` (\`userId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },
];

export function ensureSchema(): Promise<void> {
  if (!globalForPrisma.schemaReady) {
    globalForPrisma.schemaReady = (async () => {
      const rows = await getPrisma().$queryRawUnsafe<{ tableName: string }[]>(
        "SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
      );
      const existing = new Set(rows.map((row) => String(row.tableName).toLowerCase()));
      for (const { table, sql } of schemaStatements) {
        if (existing.has(table.toLowerCase())) continue;
        await getPrisma().$executeRawUnsafe(sql);
      }
    })().catch((error) => {
      globalForPrisma.schemaReady = undefined;
      throw error;
    });
  }
  return globalForPrisma.schemaReady;
}
