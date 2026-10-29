/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@google-cloud/bigquery"],
  // Gzip of HTML/JSON is on by default in `next start`; behind a CDN or reverse proxy, let that layer compress instead.
  compress: true,
  poweredByHeader: false,
  // Lets a second server (tests, a benchmark) build into its own folder instead of overwriting the one a running dev server uses.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default nextConfig;
