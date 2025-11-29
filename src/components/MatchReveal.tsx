"use client";

import { useState } from "react";
import { Contract } from "ethers";
import { getProfile } from "./ProfileSetup";

interface Props {
  fhevm: any;
  contract: Contract;
  userAddress: string;
  targetAddress: string;
}

interface ContactInfo {
  name: string;
  image: string;
  telegramId: string | null;
  twitterId: string | null;
}

export const MatchReveal: React.FC<Props> = ({
  fhevm,
  contract,
  userAddress,
  targetAddress,
}) => {
  const [status, setStatus] = useState<
    "idle" | "calculating" | "signing" | "decrypting" | "matched" | "decrypting_contact" | "revealed" | "not_matched" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);

  const checkMatchStatus = async () => {
    setStatus("calculating");
    setErrorMessage("");

    try {
      // Step 1: Call prepareMatchCheck to compute AND and grant permission
      console.log("Step 1: Computing on-chain...");
      const tx = await contract.prepareMatchCheck(targetAddress);
      await tx.wait();
      console.log("On-chain computation complete");

      // Step 2: Get handle from contract
      console.log("Step 2: Fetching handle...");
      const handle = await contract.getMatchResultHandle(userAddress);
      console.log("Handle:", handle.toString());

      if (handle.toString() === "0") {
        throw new Error("No handle found - computation may have failed");
      }

      // Step 3: User Decrypt (local decryption with user signature)
      setStatus("signing");
      console.log("Step 3: Preparing user decrypt...");

      // Generate keypair for decryption
      const { publicKey, privateKey } = fhevm.generateKeypair();
      console.log("Keypair generated");

      // Create EIP-712 signature request
      // SDK API: createEIP712(publicKey, contractAddresses[], startTimestamp, durationDays)
      const contractAddress = await contract.getAddress();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 1; // Valid for 1 day
      const eip712 = fhevm.createEIP712(publicKey, [contractAddress], startTimestamp, durationDays);
      console.log("EIP-712 created");

      // Request signature from wallet
      const signature = await window.ethereum.request({
        method: "eth_signTypedData_v4",
        params: [userAddress, JSON.stringify(eip712)],
      });
      console.log("Signature obtained");

      // Step 4: Decrypt via userDecrypt
      setStatus("decrypting");
      console.log("Step 4: Decrypting...");

      // Handle format: convert to hex string (0x-prefixed, 64 chars)
      const handleBigInt = BigInt(handle.toString());
      const handleHex = "0x" + handleBigInt.toString(16).padStart(64, "0");
      console.log("Handle (hex):", handleHex);

      // SDK API: userDecrypt(handles[], privateKey, publicKey, signature, contractAddresses[], userAddress, startTimestamp, durationDays)
      const handles = [{ handle: handleHex, contractAddress }];
      console.log("userDecrypt params:", {
        handles,
        contractAddress,
        userAddress,
      });
      const results = await fhevm.userDecrypt(
        handles,
        privateKey,
        publicKey,
        signature,
        [contractAddress],
        userAddress,
        startTimestamp,
        durationDays
      );

      console.log("Decrypted Results:", results);

      // Get the result for our handle
      const result = results[handleHex] ?? results[Object.keys(results)[0]];
      console.log("Match Result:", result);

      // Result is 0 (false) or 1 (true)
      if (result === 1n || result === 1 || result === true) {
        setStatus("matched");
      } else {
        setStatus("not_matched");
      }

    } catch (e: any) {
      console.error("Match check failed:", e);
      setErrorMessage(e.message || "Unknown error");
      setStatus("error");
    }
  };

  const revealContactInfo = async () => {
    setStatus("decrypting_contact");

    // Visual effect delay
    await new Promise((r) => setTimeout(r, 2000));

    // Fetch contact info from Supabase
    const profile = await getProfile(targetAddress);

    if (profile) {
      setContactInfo({
        name: profile.name,
        image: profile.image_url,
        telegramId: profile.telegram_id,
        twitterId: profile.twitter_id,
      });
    }

    setStatus("revealed");
  };

  return (
    <div className="text-center">
      {status === "idle" && (
        <button
          onClick={checkMatchStatus}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-full transition shadow-[0_0_15px_rgba(8,145,178,0.7)]"
        >
          Reveal Match Status
        </button>
      )}

      {status === "calculating" && (
        <div className="p-6">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-400 animate-pulse">
            Computing on blockchain...
          </p>
          <p className="text-gray-500 text-sm mt-2">
            (Step 1/3: Computing A ∧ B on-chain)
          </p>
        </div>
      )}

      {status === "signing" && (
        <div className="p-6">
          <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-yellow-400 animate-pulse">
            Please sign in your wallet...
          </p>
          <p className="text-gray-500 text-sm mt-2">
            (Step 2/3: Authorizing decryption)
          </p>
        </div>
      )}

      {status === "decrypting" && (
        <div className="p-6">
          <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-pink-400 animate-pulse">
            Decrypting locally...
          </p>
          <p className="text-gray-500 text-sm mt-2">
            (Step 3/3: Re-encryption & decrypt)
          </p>
        </div>
      )}

      {status === "matched" && (
        <div className="p-6">
          <div className="p-6 bg-gradient-to-r from-pink-500/20 to-rose-500/20 border-2 border-pink-500 rounded-xl mb-6">
            <div className="text-6xl mb-4">💕</div>
            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">
              IT&apos;S A MATCH!
            </h2>
            <p className="text-slate-300 mt-2">Trustless verification complete.</p>
          </div>

          <button
            onClick={revealContactInfo}
            className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition shadow-lg"
          >
            <span className="flex items-center gap-2 justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              Show Contact Info
            </span>
          </button>
        </div>
      )}

      {status === "decrypting_contact" && (
        <div className="p-6">
          <div className="p-6 bg-slate-800 rounded-xl border border-cyan-500/50">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse"></div>
              <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
            </div>
            <p className="text-cyan-400 font-mono text-sm">
              Loading contact info...
            </p>
          </div>
        </div>
      )}

      {status === "revealed" && contactInfo && (
        <div className="p-6">
          <div className="p-6 bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl border-2 border-pink-500/50">
            <div className="mb-6">
              <img
                src={contactInfo.image}
                alt={contactInfo.name}
                className="w-24 h-24 rounded-full border-4 border-pink-500 mx-auto object-cover"
              />
              <h3 className="text-2xl font-bold text-white mt-3">{contactInfo.name}</h3>
            </div>

            <div className="space-y-3">
              {contactInfo.telegramId && (
                <a
                  href={`https://t.me/${contactInfo.telegramId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-[#229ED9]/20 hover:bg-[#229ED9]/30 border border-[#229ED9]/50 rounded-xl transition"
                >
                  <div className="w-10 h-10 bg-[#229ED9] rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.099.154.232.17.325.015.094.035.309.02.478z"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-slate-400 text-xs">Telegram</p>
                    <p className="text-white font-medium">@{contactInfo.telegramId}</p>
                  </div>
                </a>
              )}

              {contactInfo.twitterId && (
                <a
                  href={`https://x.com/${contactInfo.twitterId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-black/50 hover:bg-black/70 border border-slate-600 rounded-xl transition"
                >
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-slate-400 text-xs">X (Twitter)</p>
                    <p className="text-white font-medium">@{contactInfo.twitterId}</p>
                  </div>
                </a>
              )}

              {!contactInfo.telegramId && !contactInfo.twitterId && (
                <p className="text-slate-500 text-sm">
                  No contact info set by this user.
                </p>
              )}
            </div>

            <p className="text-slate-500 text-xs mt-4">
              Match verified via FHE re-encryption
            </p>
          </div>
        </div>
      )}

      {status === "not_matched" && (
        <div className="p-6">
          <div className="text-6xl mb-4">😢</div>
          <p className="text-slate-400">
            No match... (one or both votes were not &quot;like&quot;)
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Verified via FHE - your votes remain private.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="p-6">
          <div className="p-4 bg-red-600/20 border border-red-500 rounded-lg">
            <p className="text-red-400">Error: {errorMessage}</p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
