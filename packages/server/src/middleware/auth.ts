import type { NextFunction, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { verifyToken } from "../db/supabase";

export interface AuthRequest extends Request { user?: User }

export async function requireInstructor(request: AuthRequest, response: Response, next: NextFunction) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "Missing bearer token" });
  try {
    request.user = await verifyToken(token);
    next();
  } catch {
    response.status(401).json({ error: "Invalid or expired token" });
  }
}
