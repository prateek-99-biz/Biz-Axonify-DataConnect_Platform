import type { Metadata } from "next";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biz Customer Intelligence",
  description: "Axonify analytics and Salesforce commercial data for Biz Group customer success teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The init script sets the theme class before hydration, so the server-rendered class list can differ.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
