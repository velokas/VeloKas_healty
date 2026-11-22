import { NextResponse } from "next/server";
import { serializeUser, userContentInclude } from "@/lib/auth";
import { ensureSchema, prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ user: null });
    await ensureSchema();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: userContentInclude,
    });
    if (!user) return NextResponse.json({ user: null });

    return NextResponse.json({ user: serializeUser(user) });
  } catch {
    console.error("GET /api/auth/me error");
    return NextResponse.json({ user: null });
  }
}
