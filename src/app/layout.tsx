import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

const terminal = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-terminal",
  display: "swap",
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://primafacie.in";
const DESCRIPTION = "A field guide to the creatures of Ashoka University. Access code required.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "ASHOKA POKEDEX",
  description: DESCRIPTION,
  // This link gets pasted into group chats — make the unfurl look like the app.
  openGraph: {
    title: "ASHOKA POKEDEX",
    description: DESCRIPTION,
    url: SITE,
    siteName: "Ashoka Pokedex",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ASHOKA POKEDEX",
    description: DESCRIPTION,
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${terminal.variable}`}>
      <body>
        <div className="crt-grain" aria-hidden />
        {children}
      </body>
    </html>
  );
}
