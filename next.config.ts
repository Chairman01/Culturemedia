import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The admin area used to live at /dashboard. Keep old bookmarks and the
    // already-installed APC bookmarklet (which opens /dashboard/sync) working.
    return [
      { source: '/dashboard', destination: '/admin/pipeline', permanent: false },
      { source: '/dashboard/login', destination: '/admin/login', permanent: false },
      { source: '/dashboard/setup', destination: '/admin/setup', permanent: false },
      { source: '/dashboard/sync', destination: '/admin/sync', permanent: false },
    ];
  },
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
