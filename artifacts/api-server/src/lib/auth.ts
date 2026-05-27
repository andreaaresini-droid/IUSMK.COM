import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "barber-artist-jwt-secret-change-in-production";
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "barber-artist-admin-jwt-secret-change-in-production";
const SALT = process.env.PASSWORD_SALT || "barber-artist-salt-change-in-prod";
const VIDEO_JWT_SECRET = process.env.VIDEO_JWT_SECRET || "barber-artist-video-stream-secret-change-in-production";

export interface JwtPayload {
  userId: number;
  email: string;
  role: "student" | "admin" | "customer";
}

export function generateToken(payload: JwtPayload, expiresIn = "30d"): string {
  const secret = payload.role === "admin" ? ADMIN_JWT_SECRET : JWT_SECRET;
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, role: "student" | "admin" | "customer" = "student"): JwtPayload | null {
  try {
    const secret = role === "admin" ? ADMIN_JWT_SECRET : JWT_SECRET;
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}

export function simpleHash(password: string): string {
  return crypto.createHash("sha256").update(password + SALT).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return simpleHash(password);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return simpleHash(password) === hash;
}

export function generateAccessCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export interface VideoTokenPayload {
  studentId: number;
  courseId: number;
  moduleId: number;
  videoPath: string;
}

export function generateVideoToken(payload: VideoTokenPayload): string {
  return jwt.sign(payload, VIDEO_JWT_SECRET, { expiresIn: "4h" } as jwt.SignOptions);
}

export function generateSecureResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyVideoToken(token: string): VideoTokenPayload | null {
  try {
    return jwt.verify(token, VIDEO_JWT_SECRET) as VideoTokenPayload;
  } catch {
    return null;
  }
}
