import { NextResponse } from "next/server";
import { ensureSchema, prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const category = (searchParams.get("category") ?? "").trim();
    const q = (searchParams.get("q") ?? "").trim();
    const activeCategory = category && category.toLowerCase() !== "semua" ? category : "";
    const textFilter = q
      ? {
          OR: [
            { caption: { contains: q } },
            { user: { name: { contains: q } } },
            { user: { email: { contains: q } } },
          ],
        }
      : {};

    const communityPosts = await prisma.communityPost.findMany({
      where: {
        ...(activeCategory ? { category: activeCategory } : {}),
        ...textFilter,
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const photos = activeCategory
      ? []
      : await prisma.photo.findMany({
          where: textFilter,
          orderBy: { createdAt: "desc" },
          include: {
            images: { orderBy: { order: "asc" } },
            user: { select: { id: true, name: true, email: true } },
          },
        });

    const photoPosts = photos
      .filter((photo) => photo.images.length > 0)
      .map((photo) => ({
        id: `photo_${photo.id}`,
        category: "Photo",
        imageUrl: photo.images[0].url,
        caption: photo.caption,
        createdAt: photo.createdAt,
        user: photo.user,
      }));

    const posts = [...photoPosts, ...communityPosts].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    return NextResponse.json({ posts });
  } catch {
    console.error("GET /api/community-posts error");
    return NextResponse.json({ error: "Gagal memuat postingan komunitas." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureSchema();

    const body = await req.json().catch(() => ({})) as {
      category?: string;
      imageUrl?: string;
      caption?: string;
    };

    const imageUrl = (body.imageUrl ?? "").trim();
    const category = (body.category ?? "Strength").trim() || "Strength";

    if (!imageUrl) {
      return NextResponse.json({ error: "Gambar postingan wajib diisi." }, { status: 400 });
    }

    const post = await prisma.communityPost.create({
      data: {
        userId,
        category,
        imageUrl,
        caption: (body.caption ?? "").trim() || null,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch {
    console.error("POST /api/community-posts error");
    return NextResponse.json({ error: "Gagal membuat postingan komunitas." }, { status: 500 });
  }
}
