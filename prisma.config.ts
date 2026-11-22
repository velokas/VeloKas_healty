import "dotenv/config";
import { defineConfig, env } from "prisma/config";

function normalizeDatabaseUrl(raw: string): string {
  const url = new URL(raw);
  if (/tidbcloud\.com/i.test(url.hostname) && !url.searchParams.has("sslaccept")) {
    url.searchParams.set("sslaccept", "strict");
  }
  return url.toString();
}

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl ? normalizeDatabaseUrl(databaseUrl) : env("DATABASE_URL"),
  },
});
