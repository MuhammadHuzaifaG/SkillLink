import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const HASH_ALGO = "sha256";
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);

function hashToken(token: string) {
  return crypto.createHash(HASH_ALGO).update(token).digest("hex");
}

export async function createRefreshToken(prisma: PrismaClient, userId: string) {
  const raw = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000);
  await prisma.refreshToken.create({
    data: { tokenHash, userId, expiresAt },
  });
  return raw; // raw is returned to client; DB holds hash
}

export async function useRefreshToken(prisma: PrismaClient, rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const token = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!token || token.revoked) return null;
  if (token.expiresAt < new Date()) return null;
  // rotate: mark old token revoked, create a new one
  await prisma.refreshToken.update({ where: { id: token.id }, data: { revoked: true } });
  const newRaw = await createRefreshToken(prisma, token.userId);
  return { user: token.user, newRaw };
}

export async function revokeRefreshToken(prisma: PrismaClient, rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const t = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!t) return false;
  await prisma.refreshToken.update({ where: { id: t.id }, data: { revoked: true } });
  return true;
}