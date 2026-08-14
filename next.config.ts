import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Metadata / form payloads only — large files go to Supabase Storage.
      // (Vercel still hard-caps Function request/response bodies at ~4.5MB.)
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
