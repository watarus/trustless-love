"use client";

import { useState, useCallback } from "react";
import { BrowserProvider, Signer } from "ethers";

export const useCoFHE = () => {
  const [cofhe, setCofhe] = useState<any | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async (provider: BrowserProvider, signer: Signer) => {
    try {
      setError(null);
      setIsInitialized(false);
      setCofhe(null);
      console.log("Initializing CoFHE SDK...");

      // Dynamic import to avoid SSR issues
      const { cofhejs, Encryptable, FheTypes } = await import("cofhejs/web");

      // Initialize with ethers provider and signer
      // Must specify environment for proper FHE key fetching
      const result = await cofhejs.initializeWithEthers({
        ethersProvider: provider,
        ethersSigner: signer,
        environment: "TESTNET",
        generatePermit: true,
      });

      console.log("CoFHE init result:", result);

      // Check initialization result
      if (!result.success) {
        const errorMsg = result.error?.message || "CoFHE initialization failed";
        console.error("CoFHE init failed:", result.error);
        setError(errorMsg);
        return;
      }

      console.log("CoFHE permit:", result.data);

      // Store both the client and utilities
      const instance = {
        client: cofhejs,
        Encryptable,
        FheTypes,
        permit: result.data,
        // Helper method to encrypt a boolean
        // encrypt expects an array and returns Result<[...items]>
        encryptBool: async (value: boolean) => {
          console.log("Encrypting bool:", value);
          const encResult = await cofhejs.encrypt([Encryptable.bool(value)]);
          console.log("Encrypt result:", encResult);
          // Result has .success for success case
          if (encResult.success && encResult.data) {
            return encResult.data[0]; // Return the first (only) encrypted item
          }
          throw new Error(encResult.error?.message || "Encryption failed");
        },
        // Get permission for contract calls
        getPermission: () => {
          const permResult = cofhejs.getPermission();
          if (permResult.success && permResult.data) {
            return permResult.data;
          }
          return null;
        },
      };

      setCofhe(instance);
      setIsInitialized(true);
      console.log("CoFHE SDK initialized successfully");
    } catch (e: any) {
      console.error("CoFHE init failed:", e);
      setError(e.message || "Failed to initialize CoFHE");
      setIsInitialized(false);
    }
  }, []);

  return { cofhe, isInitialized, error, initialize };
};
