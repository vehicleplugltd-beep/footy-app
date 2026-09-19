import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Footy — Football Price Intelligence",
  description: "Football probability, fair-price and value decision support.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
