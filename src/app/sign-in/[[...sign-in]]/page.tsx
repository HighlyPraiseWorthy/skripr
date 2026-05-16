import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

/**
 * Sign-In page using Clerk catch-all route [[...sign-in]].
 *
 * Google OAuth redirect flow (v7.3.3):
 * 1. User clicks "Continue with Google" on /sign-in
 * 2. Clerk redirects to Google OAuth
 * 3. Google redirects back to /sign-in/oauth-callback/google/[id]
 * 4. Clerk processes callback, creates session, sets __session cookie
 * 5. Clerk redirects user using this priority:
 *    a) forceRedirectUrl if passed (hardcoded string here)
 *    b) NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL if read by proxy at runtime
 *    c) "/" fallback
 *
 * v7.3.3 gotcha: NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL is sometimes NOT read
 * by the [[...sign-in]] catch-all route after a Google callback redirect,
 * because the proxy runs before the catch-all segment is resolved. Passing
 * forceRedirectUrl as a plain string here is the only reliable approach.
 *
 * ALSO: the searchParams / redirect_url path is intentionally EMPTY here.
 * Google's OAuth callback strips the redirect_url param before Clerk sees it,
 * making params.redirect_url always undefined after Google auth.
 * A hardcoded forceRedirectUrl bypasses this entirely.
 */
export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <span className="text-white font-bold">SK</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-gray-400 mt-2">Sign in to your Skripr</p>
        </div>
        <SignIn
          /*
           * Hardcoded string literal — no dynamic computation.
           * In v7.3.3 forceRedirectUrl is used ONCE after successful sign-in
           * then cleared, so the user always lands on /dashboard/scripts first.
           */
          forceRedirectUrl="/dashboard/scripts"
          fallbackRedirectUrl="/dashboard/scripts"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-gray-900 border border-gray-800 shadow-none",
              formButtonPrimary:
                "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 normal-case",
              formFieldInput: "bg-gray-800 border-gray-700 text-gray-100",
              formFieldLabel: "text-gray-300",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              dividerText: "text-gray-500",
              socialButtonsBlockButton:
                "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700",
              footerActionText: "text-gray-400",
              footerActionLink: "text-violet-400 hover:text-violet-300",
            },
          }}
        />
      </div>
    </div>
  );
}
