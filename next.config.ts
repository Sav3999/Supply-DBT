import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // allow 5MB image uploads through so saveUpload can report the friendly size error
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
