import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img1.hscicdn.com" },
      { protocol: "https", hostname: "cricketdata.org" },
    ],
  },
};

export default nextConfig;
