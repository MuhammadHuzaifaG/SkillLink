import express from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { signupSchema, loginSchema } from "../validators/auth";
import { signAccessToken } from "../utils/jwt";
import { createRefreshToken, useRefreshToken, revokeRefreshToken } from "../services/tokenService";

export default function authRoutes(prisma: PrismaClient) {
  const r = express.Router();

  r.post("/signup", async (req, res) => {
    try {
      const parsed = signupSchema.parse(req.body);
      const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
      if (existing) return res.status(400).json({ error: "Email already in use" });
      const hashed = await bcrypt.hash(parsed.password, 10);
      const user = await prisma.user.create({
        data: { name: parsed.name, email: parsed.email, password: hashed, bio: parsed.bio },
      });
      const accessToken = signAccessToken({ id: user.id });
      const refreshToken = await createRefreshToken(prisma, user.id);
      res.json({ user: { id: user.id, name: user.name, email: user.email, bio: user.bio }, accessToken, refreshToken });
    } catch (err) {
      if (err?.issues) return res.status(400).json({ error: "Invalid input", details: (err as any).issues });
      return res.status(500).json({ error: "Signup failed" });
    }
  });

  r.post("/login", async (req, res) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { email: parsed.email } });
      if (!user) return res.status(400).json({ error: "Invalid credentials" });
      const ok = await bcrypt.compare(parsed.password, user.password);
      if (!ok) return res.status(400).json({ error: "Invalid credentials" });
      const accessToken = signAccessToken({ id: user.id });
      const refreshToken = await createRefreshToken(prisma, user.id);
      res.json({ user: { id: user.id, name: user.name, email: user.email, bio: user.bio }, accessToken, refreshToken });
    } catch (err) {
      if (err?.issues) return res.status(400).json({ error: "Invalid input", details: (err as any).issues });
      return res.status(500).json({ error: "Login failed" });
    }
  });

  // token rotation: client sends refreshToken, we validate and return new pair
  r.post("/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: "Missing refreshToken" });
      const result = await useRefreshToken(prisma, refreshToken);
      if (!result) return res.status(401).json({ error: "Invalid refresh token" });
      const accessToken = signAccessToken({ id: result.user.id });
      res.json({ accessToken, refreshToken: result.newRaw });
    } catch (err) {
      return res.status(500).json({ error: "Refresh failed" });
    }
  });

  r.post("/logout", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: "Missing refreshToken" });
      await revokeRefreshToken(prisma, refreshToken);
      res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
  });

  r.get("/me", async (req, res) => {
    try {
      const header = req.headers.authorization;
      if (!header) return res.status(401).json({ error: "Missing auth" });
      const token = header.replace("Bearer ", "");
      const payload = signSafeVerify(token, prisma);
      if (!payload) return res.status(401).json({ error: "Invalid token" });
      const userId = (payload as any).id as string;
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, bio: true } });
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ user });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch me" });
    }
  });

  return r;
}

/**
 * A small helper: do not import verifyAccessToken here to avoid throwing; we re-implement safe verify.
 */
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
function signSafeVerify(token: string, _prisma: PrismaClient) {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}