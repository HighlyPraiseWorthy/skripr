import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Suspense } from "react";
import { PostHogProvider, PostHogPageView } from "@/components/PostHogProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Dark-theme every Clerk surface (UserButton popover, Manage Account modal,
// sign-in/up) to match the dashboard. @clerk/themes isn't installed, so this is
// driven by appearance.variables plus a few element overrides for the modal.
const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#4db8ff",
    colorBackground: "#0d1520",
    colorInputBackground: "#0a1220",
    borderRadius: "10px",
  },
  elements: {
    card: { border: "1px solid #1a2840" },
    navbar: { borderRight: "1px solid #1a2840" },
    userButtonPopoverCard: { border: "1px solid #1a2840" },
  },
};

export const metadata: Metadata = {
  metadataBase: new URL("https://skripr.app"),
  title: "Skripr | AI YouTube Script Generator",
  description: "Reverse-engineer any viral YouTube video into a ready-to-record script in 60 seconds.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "Skripr",
    url: "https://skripr.app",
    title: "Skripr | AI YouTube Script Generator",
    description: "YouTube scripts built on what's already winning. In your voice, ready to record.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skripr | AI YouTube Script Generator",
    description: "YouTube scripts built on what's already winning. In your voice, ready to record.",
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
