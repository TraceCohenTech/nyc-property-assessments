import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import raw from "@/data/aggregates.json";
import type { Aggregates } from "@/lib/types";
import { formatNumber, formatUSDAuto } from "@/lib/format";
import { PRODUCT_NAME } from "@/lib/nav";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const data = raw as unknown as Aggregates;
const propertiesLabel = formatNumber(data.citywide.total_properties);
const valueLabel = formatUSDAuto(data.citywide.total_market_value);

const description = `${propertiesLabel}+ NYC properties, ${valueLabel} in total market value. Explore the FY2027 DOF assessment roll by borough, tax class, zip code, building type, and owner.`;

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} | NYC FY2027 Property Assessment Roll`,
  description,
  openGraph: {
    title: PRODUCT_NAME,
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: PRODUCT_NAME,
    description,
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
      <body className="min-h-full flex flex-col text-slate-900">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Nav />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
