import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/tutti-frutti-proposal',
        destination: '/tutti-frutti-proposal/index.html',
      },
    ];
  },
};

export default nextConfig;
