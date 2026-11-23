import type { NextConfig } from "next";

// For a project site (https://<user>.github.io/<repo>/) the deploy workflow sets NEXT_PUBLIC_BASE_PATH=/<repo>.
// For a user site or a custom domain it stays empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
