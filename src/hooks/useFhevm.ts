"use client";

import { useState, useEffect } from "react";

export const useFhevm = () => {
  const [instance, setInstance] = useState<any | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Polyfill global for Node.js compatibility in browser
        if (typeof global === "undefined") {
          (window as any).global = globalThis;
        }

        // Dynamic import to avoid SSR issues with WASM
        const { initSDK, createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");

        // Initialize WASM modules first with explicit paths
        console.log("Initializing FHE SDK...");
        await initSDK({
          tfheParams: "/tfhe_bg.wasm",
          kmsParams: "/kms_lib_bg.wasm",
        });
        console.log("FHE SDK initialized");

        // Sepolia Config for fhEVM v0.9
        console.log("Using SepoliaConfig");

        const fhevmInstance = await createInstance(SepoliaConfig);
        setInstance(fhevmInstance);
        setIsInitialized(true);
        console.log("FHE initialized successfully");
      } catch (e) {
        console.error("FHE init failed", e);
      }
    };
    init();
  }, []);

  return { instance, isInitialized };
};
