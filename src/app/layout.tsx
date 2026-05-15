import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Skripr — AI-Powered YouTube Script & Growth Intelligence",
  description: "Reverse-engineer any viral video. Generate scripts that follow the exact structural patterns that make content spread.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className={`${inter.className} bg-gray-950 text-gray-100 antialiased`}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
