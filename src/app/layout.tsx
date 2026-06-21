import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import { PostHogProvider, PostHogPageView } from "@/components/PostHogProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Dark-theme every Clerk surface (UserButton popover, Manage Account modal,
// sign-in/up) to match the dashboard. @clerk/themes isn't installed, so this is
// driven by appearance.variables plus a few element overrides for the modal.
const clerkAppearance = {
  variables: {
    colorBackground: "#0d1520",
    colorText: "#e8edf5",
    colorTextSecondary: "#a6c0d8",
    colorPrimary: "#4db8ff",
    colorTextOnPrimaryBackground: "#ffffff",
    colorInputBackground: "#0a1220",
    colorInputText: "#e8edf5",
    colorNeutral: "#e8edf5",
    colorDanger: "#f87171",
    colorSuccess: "#34d399",
    borderRadius: "10px",
  },
  elements: {
    card: { backgroundColor: "#0d1520", border: "1px solid #1a2840" },
    navbar: { background: "#0a1018", borderRight: "1px solid #1a2840" },
    scrollBox: { backgroundColor: "#0d1520" },
    userButtonPopoverCard: { backgroundColor: "#0d1520", border: "1px solid #1a2840" },
    userButtonPopoverActionButton: { color: "#e8edf5" },
    formButtonPrimary: { backgroundColor: "#0e6499" },
    profileSectionPrimaryButton: { color: "#4db8ff" },
    badge: { backgroundColor: "rgba(77,184,255,0.11)", color: "#7ed8ff" },
  },
} as const;

export const metadata: Metadata = {
  title: "Skripr | AI YouTube Script Generator",
  description: "Reverse-engineer any viral YouTube video into a ready-to-record script in 60 seconds.",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" className="dark">
        <body className={`bg-gray-950 text-gray-100 antialiased`}>
          <PostHogProvider>
            <Suspense fallback={null}><PostHogPageView /></Suspense>
            {children}
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
