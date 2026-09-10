import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../utils/jwt";

export type AuthRequest = Request & { user?: any; prisma: PrismaClient };

export function authMiddleware(prisma: PrismaClient) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "Missing authorization header" });
    const token = header.replace("Bearer ", "");
    try {
      const payload = verifyAccessToken(token);
      const userId = (payload as any).id as string;
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, bio: true } });
      if (!user) return res.status(401).json({ error: "Invalid token user" });
      req.user = user;
      req.prisma = prisma;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}