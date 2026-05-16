/*
 * Clerk middleware for Skripr.
 *
 * Fixes applied:
 * 1. auth.protect() on /dashboard/* — avoids TypeError: immutable bug
 *    (auth() + redirect() causes header mutation on already-committed response)
 * 2. Signed-in users visiting / are redirected to /dashboard/scripts immediately
 *    — works around v7.3.3 NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL not being reliably
 *      read by the oauth-callback handler in the [[...sign-in]] catch-all route
 * 3. Cache-bust comment ensures Vercel picks up every deploy
 */
// cache-bust: timestamp 2025-05-16-v4
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Signed-in users hitting / land on /dashboard/scripts directly
  // (guard against v7.3.3 NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL OAuth redirect quirk)
  if (userId && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard/scripts", req.nextUrl.toString()));
  }

  // Protect all dashboard routes
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    await auth.protect();
  }
});

