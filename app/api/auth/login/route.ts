import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { serializeUser, userContentInclude } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(request: Request) {
  try {
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

    const response = NextResponse.json({ user: serializeUser(user) });
    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    console.error("POST /api/auth/login error");
    return NextResponse.json({ error: "Gagal memproses login." }, { status: 500 });
  }
}
