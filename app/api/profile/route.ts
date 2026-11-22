import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const profileSelect = {
  id: true,
  email: true,
  name: true,
  bio: true,
} as const;

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ user: { ...user, bio: user.bio ?? "" } });
  } catch {
    console.error("GET /api/profile error");
    return NextResponse.json({ error: "Gagal memuat profil." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as {
      name?: string;
      bio?: string;
      email?: string;
      club?: string;
      avatar?: string;
    };
    const data: Record<string, string | null> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (name.length < 2) {
        return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
      }
      data.name = name;
    }
    if (typeof body.bio === "string") data.bio = body.bio.trim();
    if (typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
      }
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken && taken.id !== userId) {
        return NextResponse.json({ error: "Email sudah digunakan." }, { status: 409 });
      }
      data.email = email;
    }
    if (typeof body.club === "string" && body.club.trim()) data.club = body.club.trim();
    if (typeof body.avatar === "string") data.avatar = body.avatar;

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: profileSelect,
    });

    return NextResponse.json({ user: { ...updated, bio: updated.bio ?? "" } });
  } catch {
    console.error("PATCH /api/profile error");
    return NextResponse.json({ error: "Gagal menyimpan profil." }, { status: 500 });
  }
}
