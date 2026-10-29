/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@google-cloud/bigquery"],
  // Gzip of HTML/JSON is on by default in `next start`; behind a CDN or reverse proxy, let that layer compress instead.
  compress: true,
  poweredByHeader: false,
};
export default nextConfig;
