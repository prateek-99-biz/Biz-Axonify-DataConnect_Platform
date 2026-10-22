import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biz Customer Intelligence",
  description: "Axonify analytics and Salesforce commercial data for Biz Group customer success teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
