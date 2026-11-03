import type { Metadata, Viewport } from "next";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biz Customer Intelligence",
  description: "Axonify analytics and Salesforce commercial data for Biz Group customer success teams.",
  applicationName: "Biz Customer Intelligence",
  // Absolute address for the link-preview image; Vercel supplies one itself when SITE_URL is not set.
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  openGraph: { title: "Biz Customer Intelligence", description: "Axonify analytics for customer success, a Biz Group dashboard.", siteName: "Biz Customer Intelligence", type: "website" },
};

/** Colours the phone browser bar to match the page. */
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#EEF7E8" }, { media: "(prefers-color-scheme: dark)", color: "#0B1322" }],
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
