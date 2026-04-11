import type { Metadata, Viewport } from "next";
import { Rajdhani, Inter } from "next/font/google";
import "./globals.css";

const rajdhani = Rajdhani({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-rajdhani",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IPL Fantasy",
  description: "Play fantasy cricket for IPL 2025",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#080D1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${inter.variable}`}>
      <body className="bg-surface text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
