import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prelegal",
  description: "Prelegal V1 foundation with workspace, fake login, and Mutual NDA flow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
