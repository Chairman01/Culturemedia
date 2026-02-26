import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/tutti-frutti-proposal',
        destination: '/tutti-frutti-proposal/index.html',
      },
      {
        source: '/aef-proposal',
        destination: '/aef-proposal/index.html',
      },
      {
        source: '/aef-nextsteps',
        destination: '/aef-nextsteps/index.html',
      },
    ];
  },
};

export default nextConfig;
