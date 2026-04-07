import { NextRequest } from "next/server";

/**
 * Verify the incoming request is from BanterAgent.
 * Set BOT_SECRET in .env.local — same value in banteragent .env as FANTASY_BOT_SECRET.
 */
export function botAuth(req: NextRequest): boolean {
  const secret = process.env.BOT_SECRET;
  if (!secret) return false; // no secret configured → deny
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
