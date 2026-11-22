import { NextResponse } from "next/server";
import { getCurrentUserId, hashPassword, verifyPassword } from "@/lib/auth";
import { ensureSchema, prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  await ensureSchema();

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword) return NextResponse.json({ error: "Kata sandi saat ini wajib diisi." }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: "Kata sandi baru minimal 8 karakter." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Kata sandi saat ini salah." }, { status: 401 });
  }

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  return NextResponse.json({ ok: true });
}
