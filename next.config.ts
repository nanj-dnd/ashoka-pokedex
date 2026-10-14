import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },

  // Static files under public/ are served at their exact path, so the UI kit
  // showcase would only answer on /kit/index.html. Serve it from /kit too —
  // that is the URL people get sent.
  async rewrites() {
    return [{ source: "/kit", destination: "/kit/index.html" }];
  },
};

export default nextConfig;
