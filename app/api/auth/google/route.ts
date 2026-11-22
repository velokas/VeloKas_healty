import { NextResponse } from "next/server";
import { createSession, getCurrentUser, randomPasswordHash } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type GoogleProfile = {
  sub?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  const club = typeof body.club === "string" && body.club.trim() ? body.club.trim() : "Downtown Club";
  if (!accessToken) return NextResponse.json({ error: "Token Google tidak ditemukan." }, { status: 400 });

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return NextResponse.json({ error: "Gagal memverifikasi akun Google." }, { status: 401 });

  const profile = await response.json() as GoogleProfile;
  if (!profile.email || !profile.sub || profile.email_verified === false) {
    return NextResponse.json({ error: "Profil Google tidak valid." }, { status: 401 });
  }

  const email = profile.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { avatar: profile.picture ?? existing.avatar } })
    : await prisma.user.create({
        data: {
          name: profile.name || email.split("@")[0],
          email,
          club,
          avatar: profile.picture,
          passwordHash: await randomPasswordHash(),
        },
      });

  await createSession(user.id);
  return NextResponse.json({ user: await getCurrentUser() });
}
