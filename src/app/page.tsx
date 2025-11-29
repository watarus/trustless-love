"use client";

import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract } from "ethers";
import { useFhevm } from "@/hooks/useFhevm";
import { SwipeCard } from "@/components/SwipeCard";
import { MatchReveal } from "@/components/MatchReveal";
import { ProfileSetup, getProfile, hasProfile, getProfiles } from "@/components/ProfileSetup";
import { MyPage } from "@/components/MyPage";
import { UserProfile, getAllProfiles } from "@/lib/supabase";
import TrustlessLoveABI from "@/abi/TrustlessLove.json";

// Sepolia Testnet (fhEVM v0.9 - User Decrypt Model)
const CONTRACT_ADDRESS = "0xD94F9de87176bd92717B633095123690e8cDD0a8";

// デフォルトプロフィール生成（Supabaseにない場合）
const generateDefaultProfile = (address: string) => ({
  name: `User`,
  bio: "",
  address,
  image: `https://api.dicebear.com/7.x/adventurer/svg?seed=${address}`,
});

export default function Home() {
  const { instance: fhevm, isInitialized } = useFhevm();
  const [contract, setContract] = useState<Contract | null>(null);
  const [userAddress, setUserAddress] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [hasUserProfile, setHasUserProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showMyPage, setShowMyPage] = useState(false);

  // ユーザーリストとスワイプ
  const [registeredUsers, setRegisteredUsers] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [votedUsers, setVotedUsers] = useState<Set<string>>(new Set());

  // マッチ確認用
  const [checkingMatch, setCheckingMatch] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<{address: string, bothVoted: boolean} | null>(null);

  // プロフィールキャッシュ
  const [profileCache, setProfileCache] = useState<Map<string, UserProfile>>(new Map());
  const [myProfile, setMyProfile] = useState<{name: string, bio: string, address: string, image: string, telegramId?: string, twitterId?: string} | null>(null);

  const currentTarget = registeredUsers[currentIndex];
  const targetProfile = currentTarget ? (() => {
    const cached = profileCache.get(currentTarget.toLowerCase());
    if (cached) {
      return {
        name: cached.name,
        bio: cached.bio || "",
        address: currentTarget,
        image: cached.image_url,
      };
    }
    return generateDefaultProfile(currentTarget);
  })() : null;

  // プロフィール存在チェック（非同期）
  useEffect(() => {
    const checkProfile = async () => {
      if (userAddress) {
        const exists = await hasProfile(userAddress);
        setHasUserProfile(exists);
        if (exists) {
          const profile = await getProfile(userAddress);
          if (profile) {
            setMyProfile({
              name: profile.name,
              bio: profile.bio || "",
              address: userAddress,
              image: profile.image_url,
              telegramId: profile.telegram_id || undefined,
              twitterId: profile.twitter_id || undefined,
            });
          }
        }
      }
    };
    checkProfile();
  }, [userAddress]);

  // 登録済みユーザーをSupabaseから取得 (Hybrid Architecture)
  const loadRegisteredUsers = useCallback(async () => {
    if (!contract || !userAddress) return;
    setLoadingUsers(true);
    try {
      // Supabaseから自分以外の全プロフィールを取得
      const allProfiles = await getAllProfiles(userAddress);
      console.log(`Found ${allProfiles.length} profiles in Supabase`);

      // プロフィールキャッシュを構築
      const cache = new Map<string, UserProfile>();
      allProfiles.forEach((p) => {
        cache.set(p.wallet_address.toLowerCase(), p);
      });
      setProfileCache(cache);

      // アドレスリストを取得
      const allAddresses = allProfiles.map((p) => p.wallet_address);

      // 既に投票済みのユーザーを除外 (ブロックチェーンで確認)
      const unvotedUsers: string[] = [];
      for (const addr of allAddresses) {
        try {
          const voted = await contract.hasVoted(userAddress, addr);
          if (!voted) {
            unvotedUsers.push(addr);
          } else {
            setVotedUsers((prev) => new Set([...prev, addr]));
          }
        } catch (e) {
          // コントラクトに登録されていない場合はスキップ
          console.log(`User ${addr} not registered on-chain, skipping`);
        }
      }

      setRegisteredUsers(unvotedUsers);
      setCurrentIndex(0);
    } catch (e) {
      console.error("Failed to load users:", e);
    } finally {
      setLoadingUsers(false);
    }
  }, [contract, userAddress]);

  // 登録状態チェック
  useEffect(() => {
    const checkStatus = async () => {
      if (!contract || !userAddress) return;
      try {
        const userReg = await contract.registered(userAddress);
        setIsRegistered(userReg);
        if (userReg) {
          loadRegisteredUsers();
        }
      } catch (e) {
        console.error("Failed to check status:", e);
      }
    };
    checkStatus();
  }, [contract, userAddress, loadRegisteredUsers]);

  // Sepolia chain ID
  const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

  // ウォレット接続
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask is required");
      return;
    }

    // Check and switch to Sepolia
    try {
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (currentChainId !== SEPOLIA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch (switchError: any) {
          // If Sepolia is not added, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: SEPOLIA_CHAIN_ID,
                chainName: "Sepolia Testnet",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }
    } catch (e) {
      console.error("Failed to switch network:", e);
      alert("Please switch to Sepolia network manually");
      return;
    }

    const p = new BrowserProvider(window.ethereum);
    await p.send("eth_requestAccounts", []);
    const signer = await p.getSigner();
    const addr = await signer.getAddress();

    setUserAddress(addr);

    // コントラクトインスタンス作成
    const c = new Contract(CONTRACT_ADDRESS, TrustlessLoveABI.abi, signer);
    setContract(c);
  };

  // ユーザー登録
  const registerUser = async () => {
    if (!contract) return;
    setRegistering(true);
    try {
      const tx = await contract.register();
      await tx.wait();
      setIsRegistered(true);
    } catch (e) {
      console.error("Registration failed:", e);
      alert("Registration failed. Check console.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500 mb-2">
        Trustless Love
      </h1>
      <p className="text-slate-400 mb-4 font-mono text-sm">
        Zama fhEVM Powered Dating
      </p>

      {/* 自分のプロフィール表示 */}
      {myProfile && hasUserProfile && !editingProfile && !showMyPage && (
        <div className="flex items-center gap-3 mb-6 px-4 py-2 bg-slate-800/50 rounded-full">
          <img
            src={myProfile.image}
            alt="Your avatar"
            className="w-10 h-10 rounded-full border-2 border-pink-500 object-cover"
          />
          <span className="text-white font-medium">{myProfile.name}</span>
          <span className="text-slate-500 text-xs font-mono">
            {userAddress.slice(0, 6)}...
          </span>
          <button
            onClick={() => setEditingProfile(true)}
            className="ml-2 p-1.5 text-slate-400 hover:text-pink-400 hover:bg-slate-700 rounded-full transition"
            title="Edit Profile"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => setShowMyPage(true)}
            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-full transition"
            title="My Page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
      )}

      {!userAddress ? (
        <button
          onClick={connectWallet}
          className="px-8 py-4 bg-pink-600 text-white font-bold rounded-lg hover:bg-pink-700 transition"
        >
          Connect Wallet to Start
        </button>
      ) : (
        <div className="flex flex-col items-center w-full max-w-md">
          {!isInitialized ? (
            <p className="text-cyan-400">Initializing FHE environment...</p>
          ) : !isRegistered ? (
            <div className="text-center">
              <p className="text-slate-300 mb-4">
                You need to register before swiping!
              </p>
              <button
                onClick={registerUser}
                disabled={registering}
                className="px-8 py-4 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-500 transition disabled:opacity-50"
              >
                {registering ? "Registering..." : "Register Now"}
              </button>
            </div>
          ) : !hasUserProfile || editingProfile ? (
            <div className="w-full max-w-md">
              {editingProfile && (
                <button
                  onClick={() => setEditingProfile(false)}
                  className="mb-4 text-slate-400 hover:text-white text-sm flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
              <ProfileSetup
                userAddress={userAddress}
                initialData={editingProfile && myProfile ? {
                  name: myProfile.name,
                  bio: myProfile.bio,
                  image: myProfile.image,
                  telegramId: myProfile.telegramId,
                  twitterId: myProfile.twitterId,
                } : undefined}
                onComplete={(profile) => {
                  setHasUserProfile(true);
                  setEditingProfile(false);
                  setMyProfile({
                    name: profile.name,
                    bio: profile.bio || "",
                    address: userAddress,
                    image: profile.image_url,
                    telegramId: profile.telegram_id || undefined,
                    twitterId: profile.twitter_id || undefined,
                  });
                  loadRegisteredUsers();
                }}
              />
            </div>
          ) : showMyPage ? (
            <MyPage
              contract={contract!}
              userAddress={userAddress}
              votedUsers={[...votedUsers]}
              onCheckMatch={(address) => {
                setMatchResult({ address, bothVoted: true });
                setShowMyPage(false);
              }}
              onBack={() => setShowMyPage(false)}
            />
          ) : loadingUsers ? (
            <p className="text-cyan-400 animate-pulse">Loading users...</p>
          ) : matchResult ? (
            <div className="w-full max-w-md">
              <div className="text-center mb-6 p-4 bg-cyan-500/20 border border-cyan-500 rounded-lg">
                <p className="text-cyan-400 text-lg font-bold">🔐 Both parties have voted!</p>
                <p className="text-slate-400 text-sm mt-1">
                  With: {matchResult.address.slice(0, 10)}...
                </p>
                <p className="text-slate-500 text-xs mt-2">
                  Votes are encrypted. Reveal to see if it&apos;s a match!
                </p>
              </div>
              <MatchReveal
                fhevm={fhevm}
                contract={contract!}
                userAddress={userAddress}
                targetAddress={matchResult.address}
              />
              <button
                onClick={() => setMatchResult(null)}
                className="w-full mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded"
              >
                Back to Swiping
              </button>
            </div>
          ) : registeredUsers.length === 0 ? (
            <div className="text-center">
              <p className="text-slate-400 mb-4">No users to swipe yet!</p>
              <p className="text-slate-500 text-sm">
                Invite friends to register and start matching.
              </p>
              <button
                onClick={loadRegisteredUsers}
                className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded"
              >
                Refresh Users
              </button>
            </div>
          ) : targetProfile ? (
            <>
              {contract && fhevm && (
                <>
                  <div className="mb-2 text-center">
                    <p className="text-slate-500 text-sm">
                      {currentIndex + 1} / {registeredUsers.length} users
                    </p>
                  </div>

                  <SwipeCard
                    fhevm={fhevm}
                    contract={contract}
                    userAddress={userAddress}
                    targetProfile={targetProfile}
                    onVoted={() => {
                      // 次のユーザーへ
                      setVotedUsers(prev => new Set([...prev, currentTarget]));
                      if (currentIndex < registeredUsers.length - 1) {
                        setCurrentIndex(currentIndex + 1);
                      } else {
                        // 全員スワイプ済み
                        setRegisteredUsers([]);
                      }
                    }}
                    onMatch={(targetAddress) => {
                      // マッチ！MatchReveal画面へ
                      setVotedUsers(prev => new Set([...prev, currentTarget]));
                      setMatchResult({ address: targetAddress, bothVoted: true });
                    }}
                  />
                </>
              )}
            </>
          ) : null}
        </div>
      )}
    </main>
  );
}
