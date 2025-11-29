import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Configure how WASM modules are resolved
    // The WASM file is manually copied to public/tfhe_bg.wasm
    config.resolve.alias = {
      ...config.resolve.alias,
      "tfhe_bg.wasm": join(__dirname, "public/tfhe_bg.wasm"),
    };

    // Fallback for client-side polyfills
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        buffer: false,
        fs: false,
        path: false,
      };

    }

    return config;
  },
  experimental: {
    esmExternals: "loose",
  },
};

export default nextConfig;
