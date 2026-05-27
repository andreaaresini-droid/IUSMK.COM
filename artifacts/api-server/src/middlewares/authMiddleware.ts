import { Request, Response, NextFunction } from "express";
import { verifyToken, supabaseAdmin } from "../lib/auth.js";
import { db } from "@workspace/db";
import { studentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
  userRole?: string;
  params: Record<string, string>;
}

async function resolveSupabaseUser(token: string): Promise<{ userId: number; email: string; role: string } | null> {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user?.email) return null;

  const student = await db.query.studentsTable.findFirst({
    where: eq(studentsTable.email, user.email.toLowerCase()),
  });
  if (!student) return null;

  return { userId: student.id, email: student.email, role: student.role };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (!token) { res.status(401).json({ error: "Unauthorized", message: "No token provided" }); return; }

  const jwtPayload = verifyToken(token, "student");
  if (jwtPayload) {
    req.userId = jwtPayload.userId; req.userEmail = jwtPayload.email; req.userRole = jwtPayload.role;
    return next();
  }

  const supabaseUser = await resolveSupabaseUser(token);
  if (supabaseUser) {
    req.userId = supabaseUser.userId; req.userEmail = supabaseUser.email; req.userRole = supabaseUser.role;
    return next();
  }

  res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
}

export async function requireCustomerAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (!token) { res.status(401).json({ error: "Unauthorized", message: "Devi effettuare l'accesso" }); return; }

  const jwtPayload = verifyToken(token, "student");
  if (jwtPayload && (jwtPayload.role === "customer" || jwtPayload.role === "student")) {
    req.userId = jwtPayload.userId; req.userEmail = jwtPayload.email; req.userRole = jwtPayload.role;
    return next();
  }

  const supabaseUser = await resolveSupabaseUser(token);
  if (supabaseUser && (supabaseUser.role === "customer" || supabaseUser.role === "student")) {
    req.userId = supabaseUser.userId; req.userEmail = supabaseUser.email; req.userRole = supabaseUser.role;
    return next();
  }

  res.status(401).json({ error: "Unauthorized", message: "Accesso richiesto" });
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (!token) { res.status(401).json({ error: "Unauthorized", message: "No token provided" }); return; }

  const payload = verifyToken(token, "admin");
  if (!payload || payload.role !== "admin") {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }

  req.userId = payload.userId; req.userEmail = payload.email; req.userRole = payload.role;
  next();
}
