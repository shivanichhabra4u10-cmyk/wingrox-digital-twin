import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth confirmation route — called after sign-in to ensure the session
 * cookie is flushed into the browser before redirecting to the app.
 * Fixes the race condition where redirect() in a Server Action sends the
 * 302 before Set-Cookie headers are committed.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/prototype/index.html";

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const response = NextResponse.redirect(new URL(next, request.url));

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}
