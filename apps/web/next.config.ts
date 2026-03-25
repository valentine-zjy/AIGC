import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ai-rewrite/contracts",
    "@ai-rewrite/db",
    "@ai-rewrite/storage",
  ],
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
};

export default nextConfig;
