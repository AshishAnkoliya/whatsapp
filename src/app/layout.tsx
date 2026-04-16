import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import ClientLayout from "@/components/layout/ClientLayout";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "WhatsApp Pro",
  description: "High-end mobile-first chat application",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 flex flex-col items-center">
        <main className="h-screen w-full max-w-md mx-auto bg-white shadow-xl relative flex flex-col overflow-hidden">
          <ClientLayout>{children}</ClientLayout>
          <Toaster position="top-center" richColors />
        </main>
      </body>
    </html>
  );
}
