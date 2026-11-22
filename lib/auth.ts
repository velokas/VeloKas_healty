import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { createSessionToken, getSessionUserId, SESSION_COOKIE_NAME } from "./session";

export type PhotoPost = {
  id: string;
  image: string;
  images: string[];
  caption: string;
  likes: number;
  liked: boolean;
  createdAt: string;
};

export type StoryPost = {
  id: string;
  image: string;
  createdAt: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  club: string;
  avatar: string | null;
  bio: string | null;
  photos: PhotoPost[];
  stories: StoryPost[];
};

type UserWithContent = {
  id: string;
  name: string | null;
  email: string;
  club: string;
  avatar: string | null;
  bio: string | null;
  photos: {
    id: string;
    caption: string | null;
    likes: number;
    createdAt: Date;
    images: { url: string }[];
  }[];
  stories: {
    id: string;
    mediaUrl: string;
    createdAt: Date;
  }[];
};

export const userContentInclude = {
  photos: {
    include: { images: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  },
  stories: { orderBy: { createdAt: "desc" } },
} as const;

export function serializeUser(user: UserWithContent): SessionUser {
  return {
    id: user.id,
    name: user.name ?? user.email.split("@")[0],
    email: user.email,
    club: user.club,
    avatar: user.avatar,
    bio: user.bio,
    photos: user.photos.map((photo) => ({
      id: photo.id,
      image: photo.images[0]?.url ?? "",
      images: photo.images.map((image) => image.url),
      caption: photo.caption ?? "",
      likes: photo.likes,
      liked: false,
      createdAt: photo.createdAt.toISOString(),
    })),
    stories: user.stories.map((story) => ({
      id: story.id,
      image: story.mediaUrl,
      createdAt: story.createdAt.toISOString(),
    })),
  };
}

export async function createSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUserId() {
  return getSessionUserId();
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userContentInclude,
  });
  return user ? serializeUser(user) : null;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function randomPasswordHash() {
  return hashPassword(randomBytes(32).toString("hex"));
}

export function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}
