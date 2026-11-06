import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pata",
  description: "Your door, shared only by consent.",
  icons: {
    icon: { url: "/pata-app-icon.svg", type: "image/svg+xml" },
    apple: "/icons/pata-192.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FAF5EC] text-[#1F1C18] antialiased selection:bg-[#046A38]/20">
        <div className="pata-shell">
          <header className="pata-app-header">
            <div className="pata-header-inner">
              <Link
                href="/"
                aria-label="Pata home"
                className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#046A38]"
              >
                <Image src="/pata-app-icon.svg" alt="" width={40} height={40} priority />
                <span className="pata-header-wordmark font-serif font-bold tracking-tight text-[#1F1C18]">
                  Pata
                </span>
                <span className="rounded-md bg-[#EFE5D4] px-2 py-0.5 text-xs font-medium text-[#5C5346]">
                  पता
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href="/lookup"
                  className="rounded-full border border-[#DFD1B8] bg-[#FFFDF9] px-3 py-1.5 text-xs font-medium text-[#1F1C18] transition hover:border-[#046A38]"
                >
                  Lookup
                </Link>
              </div>
            </div>
          </header>
          <div className="pata-app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
