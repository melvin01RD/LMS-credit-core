import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req) => {
  return NextResponse.json({ user: req.session });
});
