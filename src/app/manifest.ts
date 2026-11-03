import type { MetadataRoute } from "next";

/** Lets the site be added to a phone's home screen with its name, icon and brand colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Biz Customer Intelligence",
    short_name: "Biz CI",
    description: "Axonify analytics and Salesforce commercial data for Biz Group customer success teams.",
    start_url: "/portfolio",
    display: "standalone",
    background_color: "#0B1322",
    theme_color: "#79C753",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
