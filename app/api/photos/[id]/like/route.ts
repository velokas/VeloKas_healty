import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const liked = body.liked === true;
  const photo = await prisma.photo.findFirst({ where: { id, userId } });
  if (!photo) return NextResponse.json({ error: "Postingan tidak ditemukan." }, { status: 404 });

  await prisma.photo.update({
    where: { id },
    data: { likes: { increment: liked ? 1 : -1 } },
  });
  return NextResponse.json({ user: await getCurrentUser() });
}
