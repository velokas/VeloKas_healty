import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await params;
  const story = await prisma.story.findFirst({ where: { id, userId } });
  if (!story) return NextResponse.json({ error: "Story tidak ditemukan." }, { status: 404 });

  await prisma.story.delete({ where: { id } });
  return NextResponse.json({ user: await getCurrentUser() });
}
