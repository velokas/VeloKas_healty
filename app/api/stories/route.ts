import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ stories: [] });
    }

    const stories = await prisma.story.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ stories });
  } catch {
    console.error("GET /api/stories error");
    return NextResponse.json({ error: "Gagal memuat story." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { mediaUrl?: string; caption?: string; image?: string };
    const mediaUrl = (body.mediaUrl ?? body.image ?? "").trim();

    if (!mediaUrl) {
      return NextResponse.json({ error: "Media story wajib diisi." }, { status: 400 });
    }

    const story = await prisma.story.create({
      data: {
        userId,
        mediaUrl,
        caption: (body.caption ?? "").trim() || null,
      },
    });

    return NextResponse.json({ story }, { status: 201 });
  } catch {
    console.error("POST /api/stories error");
    return NextResponse.json({ error: "Gagal membuat story." }, { status: 500 });
  }
}
