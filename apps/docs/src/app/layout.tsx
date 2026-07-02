import type { Metadata } from "next";
import Link from "next/link";
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
  title: "Vitreous UI Framework",
  description: "A UX-first React component library for visualizing probabilistic AI systems.",
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
      <body className="flex min-h-full bg-[#0f1117] text-white/90 selection:bg-[#e0bc78]/30 selection:text-white">
        <aside className="w-64 shrink-0 border-r border-white/10 bg-[#0a0d14] p-6 hidden md:block">
          <h2 className="text-sm font-semibold tracking-wider text-white/40 uppercase mb-6">Documentation</h2>
          <nav className="flex flex-col gap-3">
            <Link href="/" className="text-sm text-white/70 transition hover:text-white">Quickstart</Link>
            <Link href="/node-model" className="text-sm text-white/70 transition hover:text-white">The Node Model</Link>
            <Link href="/architecture" className="text-sm text-white/70 transition hover:text-white">Branching Architecture</Link>
          </nav>
        </aside>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </body>
    </html>
  );
}
