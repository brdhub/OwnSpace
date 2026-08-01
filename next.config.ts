import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next-dev",
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
