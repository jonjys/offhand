import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Offhand — a Shopify resale store that stocks itself",
    template: "%s · Offhand",
  },
  description:
    "Offhand lists supplier products on Shopify, updates the price, and pulls the listing at zero stock. No approval queue.",
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Offhand — a Shopify resale store that stocks itself",
    description:
      "Offhand lists supplier products on Shopify, updates the price, and pulls the listing at zero stock. No approval queue.",
    url: "/",
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Offhand — a Shopify resale store that stocks itself",
    description: "Lists supplier products on Shopify, reprices them, and pulls the listing at zero stock.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
