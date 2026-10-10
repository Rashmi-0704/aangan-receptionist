import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // seed/*.md and samples/*.json are read at runtime by API routes.
  outputFileTracingIncludes: {
    "/api/**": ["./seed/services.md", "./seed/qualified.md", "./samples/*.json"],
  },
};

export default nextConfig;
