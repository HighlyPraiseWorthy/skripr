import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

/**
 * Sign-In page using Clerk catch-all route [[...sign-in]].
 *
 * How the redirect works after Google OAuth:
 * 1. Clerk reads NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard/scripts at build/runtime
 *    – this is the primary redirect target.
 * 2. We also pass forceRedirectUrl="/dashboard/scripts" directly as a prop
 *    – this overrides any fallback to "/" that Clerk might apply when
 *      it detects no redirect_url in the current URL after OAuth callback.
 * 3. If either env var or prop is missing, the page falls back to "/dashboard/scripts".
 *
 * Known issue: In v7.3.3 the env var is not always read correctly from the
 * catch-all /sign-in/[[...sign-in]] route when Google redirects back.
 * Passing forceRedirectUrl explicitly guarantees post-sign-in navigation.
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  const params = await searchParams;
  const redirectTarget = params.redirect_url || "/dashboard/scripts";

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
          /**
           * forceRedirectUrl guarantees the user lands on /dashboard/scripts
           * after any sign-in method (Google, email/password, etc.).
           * This is a documented prop in Clerk v7.x SignIn component.
           */
          forceRedirectUrl={redirectTarget}
          /**
           * fallbackRedirectUrl is used only if there is no redirect_url in the
           * current URL path (belt-and-suspenders).
           */
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
