import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // These libraries are Node-only and must not be bundled by webpack;
  // they are loaded at runtime from node_modules (App Router route handlers).
  serverExternalPackages: ["pdfjs-dist", "pdf-parse", "tesseract.js", "@napi-rs/canvas"],
};

export default nextConfig;
