import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const description =
  "Aesthetic NASA telemetry & deep-work station. Live asteroid, solar, and Earth imagery driving a cinematic focus timer.";

export const metadata: Metadata = {
  title: "ORBITAL // FOCUS",
  description,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "ORBITAL // FOCUS",
    description,
    type: "website",
    siteName: "ORBITAL // FOCUS",
  },
  twitter: {
    card: "summary_large_image",
    title: "ORBITAL // FOCUS",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#050507",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrains.variable} h-full`}
    >
      <body className="h-full bg-void font-sans text-bone antialiased">
        {children}
      </body>
    </html>
  );
}
