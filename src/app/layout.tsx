import type { Metadata } from "next";
import { Anuphan, IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

// Brand type (docs/brand/README.md): Anuphan for headings, IBM Plex Sans Thai
// for body text, IBM Plex Mono for asset numbers, dates and counts.
const display = Anuphan({
  variable: "--font-display",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

const body = IBM_Plex_Sans_Thai({
  variable: "--font-body",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

const code = IBM_Plex_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "คลังวัสดุ DBT",
  description: "ระบบยืม-คืนวัสดุและอุปกรณ์ สาขาเทคโนโลยีธุรกิจดิจิทัล (DBT)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${display.variable} ${body.variable} ${code.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
