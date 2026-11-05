import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pata",
  description: "Your door, shared only by consent.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
