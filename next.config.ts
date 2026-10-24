import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Tree-shake icon imports so only the icons we use are bundled.
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
