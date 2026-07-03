import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Glassbox — AI Transparency Framework",
  description: "UX primitives for building trustworthy AI interfaces.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full bg-[#0f1117] text-white/90 selection:bg-[#e0bc78]/30 selection:text-white">
        <aside className="w-64 shrink-0 border-r border-white/10 bg-[#0a0d14] p-6 hidden md:flex md:flex-col sticky top-0 h-screen overflow-y-auto">
          <div className="mb-8">
            <Link href="/" className="text-white font-semibold text-lg tracking-tight hover:text-[#e0bc78] transition">
              Glassbox
            </Link>
          </div>
          <nav className="flex flex-col gap-6">
            <div>
              <h2 className="text-xs font-semibold tracking-wider text-white/30 uppercase mb-3">Getting Started</h2>
              <div className="flex flex-col gap-2">
                <Link href="/why" className="text-sm text-white/70 transition hover:text-white">Why Glassbox</Link>
                <Link href="/" className="text-sm text-white/70 transition hover:text-white">Quickstart</Link>
                <Link href="/architecture" className="text-sm text-white/70 transition hover:text-white">Architecture</Link>
              </div>
            </div>
            <div>
              <h2 className="text-xs font-semibold tracking-wider text-white/30 uppercase mb-3">Components</h2>
              <div className="flex flex-col gap-2">
                <Link href="/components/spatial-rail" className="text-sm text-white/70 transition hover:text-white">Spatial Rail</Link>
                <Link href="/components/execution-gate" className="text-sm text-white/70 transition hover:text-white">Execution Gate</Link>
                <Link href="/components/conflict-resolution" className="text-sm text-white/70 transition hover:text-white">Conflict Resolution</Link>
                <Link href="/components/confidence-provenance" className="text-sm text-white/70 transition hover:text-white">Confidence Provenance</Link>
              </div>
            </div>
            <div>
              <h2 className="text-xs font-semibold tracking-wider text-white/30 uppercase mb-3">Reference</h2>
              <div className="flex flex-col gap-2">
                <Link href="/node-model" className="text-sm text-white/70 transition hover:text-white">Node Model</Link>
              </div>
            </div>
          </nav>
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </body>
    </html>
  );
}
