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
import { CallProvider } from "@/components/CallContext";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "WhatsApp Pro",
  description: "High-end mobile-first chat application",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#059669",
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
      suppressHydrationWarning
    >
      <body cz-shortcut-listen="true"
        data-new-gr-c-s-check-loaded="14.1285.0"
        data-gr-ext-installed="" className="h-full bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 flex flex-col items-center overflow-hidden overscroll-none">
        <main className="fixed inset-0 w-full max-w-md mx-auto bg-white shadow-xl flex flex-col overflow-hidden">
          <CallProvider>
            <ClientLayout>{children}</ClientLayout>
          </CallProvider>
          <Toaster position="top-center" richColors />
        </main>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(registration) {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                  }, function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
