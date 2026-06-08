import type { Metadata } from "next";
import { Archivo, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";

// GAFFER brand fonts (from design/theme.css).
const display = Archivo({
  variable: "--font-display-next",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const sans = Hanken_Grotesk({
  variable: "--font-sans-next",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "GAFFER — World Cup 2026 Fantasy",
  description:
    "FPL-style fantasy game for the 2026 World Cup with a points-only predictions layer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
