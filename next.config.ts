import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // ESG reports as base64/FormData can exceed the default 1mb limit
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
