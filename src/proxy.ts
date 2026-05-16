import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(async (auth, req) => {
  // Use auth.protect() instead of manual auth() + redirect to avoid
  // "TypeError: immutable" bug in Clerk v7.3.3 with Next.js 16 proxy
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    await auth.protect();
  }
});
