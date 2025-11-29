"use client";

import React, { useState, useRef } from "react";
import TinderCard from "react-tinder-card";
import { Contract } from "ethers";

interface TargetProfile {
  name: string;
  bio?: string;
  address: string;
  image: string;
}

interface Props {
  fhevm: any;
  contract: Contract;
  userAddress: string;
  targetProfile: TargetProfile;
  onVoted?: () => void;
  onMatch?: (targetAddress: string) => void;
}

type SwipeDirection = "left" | "right";

export const SwipeCard: React.FC<Props> = ({
  fhevm,
  contract,
  userAddress,
  targetProfile,
  onVoted,
  onMatch,
}) => {
  const [voting, setVoting] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection | null>(null);
  const cardRef = useRef<any>(null);

  const submitVote = async (isLike: boolean) => {
    setVoting(true);
    try {
      console.log("Encrypting vote...");
      const contractAddress = await contract.getAddress();
      const input = fhevm.createEncryptedInput(contractAddress, userAddress);
      input.addBool(isLike);
      const encryptedData = await input.encrypt();

      const tx = await contract.vote(
        targetProfile.address,
        encryptedData.handles[0],
        encryptedData.inputProof
      );

      console.log("Mining transaction...");
      await tx.wait();
      console.log(`Vote casted securely! Like: ${isLike}`);

      // Likeの場合、相手が既に投票済みかチェック（内容は不明）
      if (isLike && onMatch) {
        try {
          const theyVoted = await contract.hasVoted(targetProfile.address, userAddress);
          if (theyVoted) {
            console.log("Both parties have voted! Ready to reveal match status.");
            onMatch(targetProfile.address);
            return;
          }
        } catch (e) {
          console.error("Vote check failed:", e);
        }
      }

      if (onVoted) onVoted();
    } catch (error) {
      console.error("Vote failed:", error);
      alert("Vote failed. Check console.");
      setVoting(false);
    }
  };

  const onSwipe = (direction: string) => {
    if (voting) return;
    const isLike = direction === "right";
    submitVote(isLike);
  };

  const handleButtonClick = async (direction: SwipeDirection) => {
    if (voting) return;
    setSwipeDirection(direction);

    // カードをプログラムでスワイプ
    if (cardRef.current) {
      await cardRef.current.swipe(direction);
    }
  };

  const onCardLeftScreen = () => {
    // カードが画面外に出た後の処理
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* カード */}
      <div className="relative w-80 h-[420px]">
        <TinderCard
          ref={cardRef}
          onSwipe={onSwipe}
          onCardLeftScreen={onCardLeftScreen}
          preventSwipe={["up", "down"]}
          swipeRequirementType="position"
          swipeThreshold={100}
          className="absolute inset-0"
        >
          <div className="relative w-80 h-[420px] bg-slate-800 rounded-2xl shadow-2xl flex flex-col border-2 border-pink-500/30 overflow-hidden cursor-grab active:cursor-grabbing select-none">
            {/* LIKE/NOPE ラベル */}
            <div className="absolute top-4 left-4 z-10 px-3 py-1 border-4 border-green-500 rounded-lg rotate-[-20deg] opacity-0 pointer-events-none"
                 style={{ opacity: swipeDirection === 'right' ? 1 : 0 }}>
              <span className="text-green-500 font-black text-2xl">LIKE</span>
            </div>
            <div className="absolute top-4 right-4 z-10 px-3 py-1 border-4 border-red-500 rounded-lg rotate-[20deg] opacity-0 pointer-events-none"
                 style={{ opacity: swipeDirection === 'left' ? 1 : 0 }}>
              <span className="text-red-500 font-black text-2xl">NOPE</span>
            </div>

            {/* Avatar */}
            <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-slate-700 to-slate-800 p-6">
              <img
                src={targetProfile.image}
                alt={targetProfile.name}
                className="w-44 h-44 rounded-full border-4 border-pink-500 shadow-lg object-cover"
                draggable={false}
              />
            </div>

            {/* Info */}
            <div className="bg-black/70 backdrop-blur-sm p-5 text-white">
              <h3 className="text-2xl font-bold">{targetProfile.name}</h3>
              {targetProfile.bio && (
                <p className="text-sm text-slate-300 mt-1 line-clamp-2">{targetProfile.bio}</p>
              )}
              <p className="text-xs text-pink-400 font-mono mt-2">
                {targetProfile.address.slice(0, 10)}...{targetProfile.address.slice(-6)}
              </p>
            </div>

            {/* Voting Overlay */}
            {voting && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-white font-medium">Encrypting & Sending...</p>
                </div>
              </div>
            )}
          </div>
        </TinderCard>
      </div>

      {/* アクションボタン */}
      <div className="flex items-center gap-8">
        {/* Pass Button */}
        <button
          onClick={() => handleButtonClick("left")}
          disabled={voting}
          className="w-16 h-16 rounded-full bg-slate-800 border-2 border-red-500 flex items-center justify-center hover:bg-red-500/20 hover:scale-110 transition-all disabled:opacity-50 disabled:hover:scale-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Like Button */}
        <button
          onClick={() => handleButtonClick("right")}
          disabled={voting}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center hover:from-pink-400 hover:to-rose-400 hover:scale-110 transition-all shadow-lg shadow-pink-500/30 disabled:opacity-50 disabled:hover:scale-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
      </div>

      {/* ヒント */}
      <p className="text-slate-500 text-sm">
        Swipe or tap buttons
      </p>
    </div>
  );
};
