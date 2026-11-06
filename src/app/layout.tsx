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
      <body className="min-h-screen bg-[#1A1816] text-[#1F1C18] antialiased selection:bg-[#046A38]/20">
        <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#FAF5EC] shadow-2xl">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#E6DAC6] bg-[#FAF5EC]/95 px-5 backdrop-blur-sm">
            <Link
              href="/"
              aria-label="Pata home"
              className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#046A38]"
            >
              <Image src="/pata-app-icon.svg" alt="" width={40} height={40} priority />
              <span className="font-serif text-3xl font-bold tracking-tight text-[#1F1C18]">Pata</span>
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
          </header>
          <div className="flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
