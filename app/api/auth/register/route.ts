import { NextResponse } from "next/server";
import { createSession, getCurrentUser, hashPassword } from "@/lib/auth";
import { ensureSchema, prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const club = typeof body.club === "string" && body.club.trim() ? body.club.trim() : "Downtown Club";

  if (name.length < 2) return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Masukkan alamat email yang valid." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Kata sandi minimal 8 karakter." }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email sudah terdaftar. Silakan masuk." }, { status: 409 });

  const user = await prisma.user.create({
    data: { name, email, club, passwordHash: await hashPassword(password) },
  });
  await createSession(user.id);
  return NextResponse.json({ user: await getCurrentUser() });
}
