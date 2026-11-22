import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ photos: [] });
    }

    const photos = await prisma.photo.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        images: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ photos });
  } catch {
    console.error("GET /api/photos error");
    return NextResponse.json({ error: "Gagal memuat foto." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { caption?: string; images?: unknown };
    const images = Array.isArray(body.images)
      ? body.images.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      : [];

    if (images.length === 0) {
      return NextResponse.json({ error: "Minimal 1 gambar diperlukan." }, { status: 400 });
    }
    if (images.length > 10) {
      return NextResponse.json({ error: "Maksimal 10 gambar per post." }, { status: 400 });
    }

    const photo = await prisma.photo.create({
      data: {
        userId,
        caption: (body.caption ?? "").trim() || null,
        images: {
          create: images.map((url, idx) => ({
            url: url.trim(),
            order: idx,
          })),
        },
      },
      include: {
        images: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ photo }, { status: 201 });
  } catch {
    console.error("POST /api/photos error");
    return NextResponse.json({ error: "Gagal membuat postingan." }, { status: 500 });
  }
}
