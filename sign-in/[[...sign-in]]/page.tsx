import { SignIn } from "@clerk/nextjs";

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
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-gray-900 border border-gray-800 shadow-none",
              formButtonPrimary: "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 normal-case",
              formFieldInput: "bg-gray-800 border-gray-700 text-gray-100",
              formFieldLabel: "text-gray-300",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              dividerText: "text-gray-500",
              socialButtonsBlockButton: "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700",
              footerActionText: "text-gray-400",
              footerActionLink: "text-violet-400 hover:text-violet-300",
            },
          }}
        />
      </div>
    </div>
  );
}
