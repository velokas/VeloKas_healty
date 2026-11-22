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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS \`User\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`email\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NULL,
    \`bio\` VARCHAR(191) NULL,
    \`club\` VARCHAR(191) NOT NULL DEFAULT 'Downtown Club',
    \`avatar\` LONGTEXT NULL,
    \`passwordHash\` VARCHAR(191) NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`User_email_key\` (\`email\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`Photo\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`caption\` VARCHAR(191) NULL,
    \`likes\` INTEGER NOT NULL DEFAULT 0,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`Photo_userId_idx\` (\`userId\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`PhotoImage\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`photoId\` VARCHAR(191) NOT NULL,
    \`url\` LONGTEXT NOT NULL,
    \`order\` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (\`id\`),
    KEY \`PhotoImage_photoId_idx\` (\`photoId\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`Story\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`mediaUrl\` LONGTEXT NOT NULL,
    \`caption\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`Story_userId_idx\` (\`userId\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`CommunityPost\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`category\` VARCHAR(191) NOT NULL,
    \`imageUrl\` LONGTEXT NOT NULL,
    \`caption\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`CommunityPost_userId_idx\` (\`userId\`)
  )`,
];

export function ensureSchema(): Promise<void> {
  if (!globalForPrisma.schemaReady) {
    globalForPrisma.schemaReady = (async () => {
      for (const statement of schemaStatements) {
        await prisma.$executeRawUnsafe(statement);
      }
    })().catch((error) => {
      globalForPrisma.schemaReady = undefined;
      throw error;
    });
  }
  return globalForPrisma.schemaReady;
}
