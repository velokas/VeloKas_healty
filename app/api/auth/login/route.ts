import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, serializeUser, userContentInclude } from "@/lib/auth";
import { ensureSchema, prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email }, include: userContentInclude });

    if (!user) {
      const defaultName = typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : email.split("@")[0].replace(/[._-]+/g, " ");
      await prisma.user.create({
        data: {
          email,
          name: defaultName,
          bio: "",
          passwordHash: await bcrypt.hash(password, 10),
        },
      });
      user = await prisma.user.findUniqueOrThrow({ where: { email }, include: userContentInclude });
    } else if (!(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    console.error("POST /api/auth/login error", error);
    return NextResponse.json(
      { error: "Login gagal. Periksa koneksi database lalu coba lagi." },
      { status: 500 }
    );
  }
}
