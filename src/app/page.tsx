"use client";

import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract } from "ethers";
import { useFhevm } from "@/hooks/useFhevm";
import { useCoFHE } from "@/hooks/useCoFHE";
import { SwipeCard } from "@/components/SwipeCard";
import { SwipeCardCoFHE } from "@/components/SwipeCardCoFHE";
import { MatchReveal } from "@/components/MatchReveal";
import { MatchRevealCoFHE } from "@/components/MatchRevealCoFHE";
import { ProfileSetup, getProfile, hasProfile } from "@/components/ProfileSetup";
import { MyPage } from "@/components/MyPage";
import { UserProfile, getAllProfiles } from "@/lib/supabase";
import TrustlessLoveABI from "@/abi/TrustlessLove.json";
import TrustlessLoveCoFHEABI from "@/abi/TrustlessLoveCoFHE.json";

// Network configurations
type NetworkType = "zama" | "cofhe";

const NETWORKS = {
  zama: {
    name: "Zama fhEVM",
    chainId: "0xaa36a7", // 11155111 (Sepolia)
    chainIdNum: 11155111,
    contractAddress: "0xD94F9de87176bd92717B633095123690e8cDD0a8",
    rpcUrl: "https://rpc.sepolia.org",
    blockExplorer: "https://sepolia.etherscan.io",
    color: "pink",
  },
  cofhe: {
    name: "Fhenix CoFHE",
    chainId: "0xaa36a7", // 11155111 (Sepolia)
    chainIdNum: 11155111,
    contractAddress: "0xed7840d021803D0c4A89D3184B610E8466F1eF26",
    rpcUrl: "https://rpc.sepolia.org",
    blockExplorer: "https://sepolia.etherscan.io",
    color: "cyan",
  },
};

const generateDefaultProfile = (address: string) => ({
  name: `User`,
  bio: "",
  address,
  image: `https://api.dicebear.com/7.x/adventurer/svg?seed=${address}`,
});

export default function Home() {
  // Network selection
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>("zama");
  const networkConfig = NETWORKS[selectedNetwork];

  // Zama fhEVM hook
  const { instance: fhevm, isInitialized: zamaInitialized } = useFhevm();

  // CoFHE hook
  const { cofhe, isInitialized: cofheInitialized, error: cofheError, initialize: initCoFHE } = useCoFHE();

  // Common state
  const [contract, setContract] = useState<Contract | null>(null);
  const [userAddress, setUserAddress] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [hasUserProfile, setHasUserProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showMyPage, setShowMyPage] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);

  // User list and swiping
  const [registeredUsers, setRegisteredUsers] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [votedUsers, setVotedUsers] = useState<Set<string>>(new Set());

  // Match checking
  const [matchResult, setMatchResult] = useState<{address: string, bothVoted: boolean} | null>(null);

  // Profile cache
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

  // Check if FHE is initialized based on network
  const isFheInitialized = selectedNetwork === "zama" ? zamaInitialized : cofheInitialized;

  // Profile check
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

  // Load registered users from Supabase
  const loadRegisteredUsers = useCallback(async () => {
    if (!contract || !userAddress) return;
    setLoadingUsers(true);
    try {
      const allProfiles = await getAllProfiles(userAddress);
      console.log(`Found ${allProfiles.length} profiles in Supabase`);

      const cache = new Map<string, UserProfile>();
      allProfiles.forEach((p) => {
        cache.set(p.wallet_address.toLowerCase(), p);
      });
      setProfileCache(cache);

      const allAddresses = allProfiles.map((p) => p.wallet_address);

      const unvotedUsers: string[] = [];
      for (const addr of allAddresses) {
        try {
          // Check if target user is registered on current contract
          const targetRegistered = await contract.registered(addr);
          if (!targetRegistered) {
            console.log(`User ${addr} not registered on this contract, skipping`);
            continue;
          }

          const voted = await contract.hasVoted(userAddress, addr);
          if (!voted) {
            unvotedUsers.push(addr);
          } else {
            setVotedUsers((prev) => new Set([...prev, addr]));
          }
        } catch (e) {
          console.log(`Error checking user ${addr}:`, e);
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

  // Check registration status
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

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask is required");
      return;
    }

    // Check and switch to correct network
    try {
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (currentChainId !== networkConfig.chainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: networkConfig.chainId }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: networkConfig.chainId,
                chainName: "Sepolia Testnet",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: [networkConfig.rpcUrl],
                blockExplorerUrls: [networkConfig.blockExplorer],
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

    setProvider(p);
    setUserAddress(addr);

    // Initialize CoFHE if selected
    if (selectedNetwork === "cofhe" && !cofheInitialized) {
      await initCoFHE(p, signer);
    }

    // Create contract instance with appropriate ABI
    const abi = selectedNetwork === "zama" ? TrustlessLoveABI.abi : TrustlessLoveCoFHEABI.abi;
    const c = new Contract(networkConfig.contractAddress, abi, signer);
    setContract(c);
  };

  // Handle network switch
  const handleNetworkSwitch = async (network: NetworkType) => {
    if (network === selectedNetwork) return;

    // Reset state when switching networks
    setContract(null);
    setIsRegistered(false);
    setRegisteredUsers([]);
    setVotedUsers(new Set());
    setMatchResult(null);

    setSelectedNetwork(network);

    // If already connected, reconnect with new network
    if (userAddress && provider) {
      const signer = await provider.getSigner();

      // Initialize CoFHE if switching to it
      if (network === "cofhe" && !cofheInitialized) {
        await initCoFHE(provider, signer);
      }

      const newConfig = NETWORKS[network];
      const abi = network === "zama" ? TrustlessLoveABI.abi : TrustlessLoveCoFHEABI.abi;
      const c = new Contract(newConfig.contractAddress, abi, signer);
      setContract(c);
    }
  };

  // Register user
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

  const themeColor = networkConfig.color === "pink" ? {
    primary: "from-pink-500 to-cyan-500",
    button: "bg-pink-600 hover:bg-pink-700",
    accent: "text-pink-400",
    border: "border-pink-500",
  } : {
    primary: "from-cyan-500 to-blue-500",
    button: "bg-cyan-600 hover:bg-cyan-500",
    accent: "text-cyan-400",
    border: "border-cyan-500",
  };

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Network Selector */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex gap-2 bg-slate-800/80 backdrop-blur-sm rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => handleNetworkSwitch("zama")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
              selectedNetwork === "zama"
                ? "bg-pink-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
          >
            Zama fhEVM
          </button>
          <button
            onClick={() => handleNetworkSwitch("cofhe")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
              selectedNetwork === "cofhe"
                ? "bg-cyan-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
          >
            Fhenix CoFHE
          </button>
        </div>
      </div>

      <h1 className={`text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r ${themeColor.primary} mb-2`}>
        Trustless Love
      </h1>
      <p className="text-slate-400 mb-4 font-mono text-sm">
        {networkConfig.name} Powered Dating
      </p>

      {/* Profile display */}
      {myProfile && hasUserProfile && !editingProfile && !showMyPage && (
        <div className="flex items-center gap-3 mb-6 px-4 py-2 bg-slate-800/50 rounded-full">
          <img
            src={myProfile.image}
            alt="Your avatar"
            className={`w-10 h-10 rounded-full border-2 ${themeColor.border} object-cover`}
          />
          <span className="text-white font-medium">{myProfile.name}</span>
          <span className="text-slate-500 text-xs font-mono">
            {userAddress.slice(0, 6)}...
          </span>
          <button
            onClick={() => setEditingProfile(true)}
            className={`ml-2 p-1.5 text-slate-400 hover:${themeColor.accent} hover:bg-slate-700 rounded-full transition`}
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
          className={`px-8 py-4 ${themeColor.button} text-white font-bold rounded-lg transition`}
        >
          Connect Wallet to Start
        </button>
      ) : (
        <div className="flex flex-col items-center w-full max-w-md">
          {!isFheInitialized ? (
            <div className="text-center">
              {selectedNetwork === "cofhe" && cofheError ? (
                <div className="text-center">
                  <p className="text-red-400 mb-4">CoFHE initialization failed:</p>
                  <p className="text-red-300 text-sm mb-4">{cofheError}</p>
                  <button
                    onClick={async () => {
                      if (provider) {
                        const signer = await provider.getSigner();
                        await initCoFHE(provider, signer);
                      }
                    }}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded"
                  >
                    Retry Initialization
                  </button>
                </div>
              ) : (
                <p className={themeColor.accent}>Initializing FHE environment...</p>
              )}
            </div>
          ) : !isRegistered ? (
            <div className="text-center">
              <p className="text-slate-300 mb-4">
                You need to register before swiping!
              </p>
              <button
                onClick={registerUser}
                disabled={registering}
                className={`px-8 py-4 ${themeColor.button} text-white font-bold rounded-lg transition disabled:opacity-50`}
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
            <p className={`${themeColor.accent} animate-pulse`}>Loading users...</p>
          ) : matchResult ? (
            <div className="w-full max-w-md">
              <div className={`text-center mb-6 p-4 bg-${networkConfig.color}-500/20 border ${themeColor.border} rounded-lg`}>
                <p className={themeColor.accent + " text-lg font-bold"}>Both parties have voted!</p>
                <p className="text-slate-400 text-sm mt-1">
                  With: {matchResult.address.slice(0, 10)}...
                </p>
                <p className="text-slate-500 text-xs mt-2">
                  Votes are encrypted. Reveal to see if it&apos;s a match!
                </p>
              </div>
              {selectedNetwork === "zama" ? (
                <MatchReveal
                  fhevm={fhevm}
                  contract={contract!}
                  userAddress={userAddress}
                  targetAddress={matchResult.address}
                />
              ) : (
                <MatchRevealCoFHE
                  cofhe={cofhe}
                  contract={contract!}
                  userAddress={userAddress}
                  targetAddress={matchResult.address}
                />
              )}
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
                className={`mt-4 px-4 py-2 ${themeColor.button} text-white rounded`}
              >
                Refresh Users
              </button>
            </div>
          ) : targetProfile ? (
            <>
              {contract && (selectedNetwork === "zama" ? fhevm : cofhe) && (
                <>
                  <div className="mb-2 text-center">
                    <p className="text-slate-500 text-sm">
                      {currentIndex + 1} / {registeredUsers.length} users
                    </p>
                  </div>

                  {selectedNetwork === "zama" ? (
                    <SwipeCard
                      fhevm={fhevm}
                      contract={contract}
                      userAddress={userAddress}
                      targetProfile={targetProfile}
                      onVoted={() => {
                        setVotedUsers(prev => new Set([...prev, currentTarget]));
                        if (currentIndex < registeredUsers.length - 1) {
                          setCurrentIndex(currentIndex + 1);
                        } else {
                          setRegisteredUsers([]);
                        }
                      }}
                      onMatch={(targetAddress) => {
                        setVotedUsers(prev => new Set([...prev, currentTarget]));
                        setMatchResult({ address: targetAddress, bothVoted: true });
                      }}
                    />
                  ) : (
                    <SwipeCardCoFHE
                      cofhe={cofhe}
                      contract={contract}
                      userAddress={userAddress}
                      targetProfile={targetProfile}
                      onVoted={() => {
                        setVotedUsers(prev => new Set([...prev, currentTarget]));
                        if (currentIndex < registeredUsers.length - 1) {
                          setCurrentIndex(currentIndex + 1);
                        } else {
                          setRegisteredUsers([]);
                        }
                      }}
                      onMatch={(targetAddress) => {
                        setVotedUsers(prev => new Set([...prev, currentTarget]));
                        setMatchResult({ address: targetAddress, bothVoted: true });
                      }}
                    />
                  )}
                </>
              )}
            </>
          ) : null}
        </div>
      )}
    </main>
  );
}
