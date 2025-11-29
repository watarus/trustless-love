"use client";

import { useState, useEffect } from "react";
import { Contract } from "ethers";
import { getProfiles } from "./ProfileSetup";
import { UserProfile } from "@/lib/supabase";

interface Props {
  contract: Contract;
  userAddress: string;
  votedUsers: string[];
  onCheckMatch: (address: string) => void;
  onBack: () => void;
}

interface LikedUser {
  address: string;
  profile: UserProfile | null;
  theyVotedBack: boolean | null; // null = checking
}

export const MyPage: React.FC<Props> = ({
  contract,
  userAddress,
  votedUsers,
  onCheckMatch,
  onBack,
}) => {
  const [likedUsers, setLikedUsers] = useState<LikedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LikedUser | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // プロフィールを一括取得
        const profiles = await getProfiles(votedUsers);

        // 初期データをセット
        const users: LikedUser[] = votedUsers.map((addr) => ({
          address: addr,
          profile: profiles.get(addr.toLowerCase()) || null,
          theyVotedBack: null,
        }));
        setLikedUsers(users);

        // 相手が投票したかチェック
        for (let i = 0; i < users.length; i++) {
          const addr = users[i].address;
          try {
            const theyVoted = await contract.hasVoted(addr, userAddress);
            setLikedUsers((prev) =>
              prev.map((u) =>
                u.address === addr ? { ...u, theyVotedBack: theyVoted } : u
              )
            );
          } catch (e) {
            console.error("Failed to check vote:", e);
          }
        }
      } catch (e) {
        console.error("Failed to load data:", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [contract, userAddress, votedUsers]);

  const bothVoted = likedUsers.filter((u) => u.theyVotedBack === true);
  const pending = likedUsers.filter((u) => u.theyVotedBack === false);
  const checking = likedUsers.filter((u) => u.theyVotedBack === null);

  return (
    <div className="w-full max-w-md">
      <button
        onClick={onBack}
        className="mb-4 text-slate-400 hover:text-white text-sm flex items-center gap-1"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Swipe
      </button>

      <div className="bg-slate-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-6">My Activity</h2>

        {loading ? (
          <p className="text-cyan-400 animate-pulse">Loading...</p>
        ) : likedUsers.length === 0 ? (
          <p className="text-slate-400">You haven&apos;t liked anyone yet.</p>
        ) : (
          <>
            {/* Both Voted - Ready to Reveal */}
            {bothVoted.length > 0 && (
              <div className="mb-6">
                <h3 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
                  <span className="text-lg">🔐</span> Ready to Reveal ({bothVoted.length})
                </h3>
                <div className="space-y-2">
                  {bothVoted.map((user) => (
                    <div
                      key={user.address}
                      className="flex items-center gap-3 p-3 bg-cyan-500/20 border border-cyan-500/50 rounded-lg"
                    >
                      <img
                        src={
                          user.profile?.image_url ||
                          `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.address}`
                        }
                        alt="Avatar"
                        className="w-12 h-12 rounded-full border-2 border-cyan-500 object-cover"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium">
                          {user.profile?.name || "User"}
                        </p>
                        <p className="text-cyan-400 text-xs font-mono">
                          {user.address.slice(0, 10)}...
                        </p>
                      </div>
                      <button
                        onClick={() => onCheckMatch(user.address)}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition"
                      >
                        Reveal Match
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending */}
            {pending.length > 0 && (
              <div className="mb-6">
                <h3 className="text-slate-400 font-semibold mb-3 flex items-center gap-2">
                  <span className="text-lg">⏳</span> Waiting ({pending.length})
                </h3>
                <div className="space-y-2">
                  {pending.map((user) => (
                    <button
                      key={user.address}
                      onClick={() => setSelectedUser(user)}
                      className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition text-left"
                    >
                      <img
                        src={
                          user.profile?.image_url ||
                          `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.address}`
                        }
                        alt="Avatar"
                        className="w-12 h-12 rounded-full border-2 border-slate-500 object-cover"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium">
                          {user.profile?.name || "User"}
                        </p>
                        <p className="text-slate-500 text-xs font-mono">
                          {user.address.slice(0, 10)}...
                        </p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Checking */}
            {checking.length > 0 && (
              <div>
                <p className="text-slate-500 text-sm animate-pulse">
                  Checking {checking.length} more...
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Profile Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-slate-800 rounded-2xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Image */}
            <div className="bg-gradient-to-b from-slate-700 to-slate-800 p-8 flex justify-center">
              <img
                src={
                  selectedUser.profile?.image_url ||
                  `https://api.dicebear.com/7.x/adventurer/svg?seed=${selectedUser.address}`
                }
                alt="Avatar"
                className="w-32 h-32 rounded-full border-4 border-pink-500 object-cover"
              />
            </div>

            {/* Info */}
            <div className="p-6">
              <h3 className="text-2xl font-bold text-white text-center">
                {selectedUser.profile?.name || "User"}
              </h3>

              <p className="text-pink-400 text-xs font-mono text-center mt-1">
                {selectedUser.address.slice(0, 10)}...{selectedUser.address.slice(-6)}
              </p>

              {selectedUser.profile?.bio && (
                <p className="text-slate-300 text-center mt-4">
                  {selectedUser.profile.bio}
                </p>
              )}

              {/* Status */}
              <div className="mt-6 p-3 bg-slate-700/50 rounded-lg text-center">
                <p className="text-slate-400 text-sm">
                  ⏳ Waiting for them to swipe...
                </p>
              </div>

              {/* Contact Info Hidden Message */}
              <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-cyan-400 text-xs text-center flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Contact info revealed after match
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedUser(null)}
                className="w-full mt-6 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
