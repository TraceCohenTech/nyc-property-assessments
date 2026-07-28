import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "NYC FY2027 Property Assessment Roll | ValueAddVC",
  description:
    "1.17M+ NYC properties, $1.9T in market value. Explore the FY2027 DOF assessment roll by borough, tax class, zip code, building type, and owner — plus the tax-equity gap between homeowners and everyone else.",
  openGraph: {
    title: "NYC FY2027 Property Assessment Roll",
    description:
      "1.17M+ NYC properties, $1.9T in market value — explored by borough, tax class, zip, building type, and owner.",
    type: "website",
  },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
