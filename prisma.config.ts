import "dotenv/config";
import { defineConfig } from "prisma/config";

function normalizeDatabaseUrl(raw: string): string {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (/tidbcloud\.com/i.test(url.hostname) && !url.searchParams.has("sslaccept")) {
      url.searchParams.set("sslaccept", "strict");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: normalizeDatabaseUrl(process.env.DATABASE_URL ?? ""),
  },
});
