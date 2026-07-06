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
  title: "Vitreous — an AI supervision cockpit",
  description:
    "A live demo of inspectable, steerable AI reasoning: grounded confidence, execution gates, and conflicts that halt for human arbitration instead of being averaged away.",
  metadataBase: new URL("https://vitreous-playground.vercel.app"),
  openGraph: {
    title: "Vitreous — an AI supervision cockpit",
    description:
      "Watch an AI hit contradictory evidence, stop, and ask a human to arbitrate — with every reasoning step inspectable and every action gated.",
    url: "https://vitreous-playground.vercel.app",
    siteName: "Vitreous Playground",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Vitreous — an AI supervision cockpit",
    description:
      "Inspectable, steerable AI reasoning: grounded confidence, execution gates, conflicts that halt for human arbitration."
  }
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
