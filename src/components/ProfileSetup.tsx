"use client";

import { useState, useRef } from "react";
import { supabase, UserProfile } from "@/lib/supabase";

interface Props {
  userAddress: string;
  onComplete: (profile: UserProfile) => void;
  initialData?: {
    name: string;
    bio: string;
    image: string;
    telegramId?: string;
    twitterId?: string;
  };
}

// アバター画像のプリセット
const AVATAR_PRESETS = [
  "https://api.dicebear.com/7.x/adventurer/svg?seed=felix",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=luna",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=max",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=mia",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=leo",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=bella",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=charlie",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=daisy",
];

// カスタムアバターをアップロード
const uploadAvatar = async (file: File, walletAddress: string): Promise<string | null> => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${walletAddress.toLowerCase()}.${fileExt}`;
  const filePath = fileName;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  return data.publicUrl;
};

export const ProfileSetup: React.FC<Props> = ({ userAddress, onComplete, initialData }) => {
  const [name, setName] = useState(initialData?.name || "");
  const [bio, setBio] = useState(initialData?.bio || "");
  const [telegramId, setTelegramId] = useState(initialData?.telegramId || "");
  const [twitterId, setTwitterId] = useState(initialData?.twitterId || "");
  const [selectedAvatar, setSelectedAvatar] = useState(
    initialData?.image || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userAddress}`
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB");
      return;
    }

    // 画像タイプチェック
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadAvatar(file, userAddress);
      if (url) {
        setSelectedAvatar(url);
      } else {
        alert("Failed to upload image");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    setSaving(true);
    try {
      const profile: UserProfile = {
        wallet_address: userAddress.toLowerCase(),
        name: name.trim(),
        bio: bio.trim() || null,
        image_url: selectedAvatar,
        telegram_id: telegramId.trim() || null,
        twitter_id: twitterId.trim().replace('@', '') || null,
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(profile, { onConflict: "wallet_address" });

      if (error) throw error;

      onComplete(profile);
    } catch (e: any) {
      console.error("Failed to save profile:", e);
      alert("Failed to save profile: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-slate-800 rounded-xl">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">
        Set Up Your Profile
      </h2>

      {/* Avatar Selection */}
      <div className="mb-6">
        <p className="text-slate-400 text-sm mb-3">Choose your avatar:</p>
        <div className="flex justify-center mb-4">
          <div className="relative">
            <img
              src={selectedAvatar}
              alt="Selected Avatar"
              className="w-24 h-24 rounded-full border-4 border-pink-500 object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <span className="text-white text-xs">Uploading...</span>
              </div>
            )}
          </div>
        </div>

        {/* Upload Button */}
        <div className="flex justify-center mb-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Custom Photo"}
          </button>
        </div>

        <p className="text-slate-500 text-xs text-center mb-3">Or choose a preset:</p>
        <div className="grid grid-cols-4 gap-2">
          {AVATAR_PRESETS.map((url, i) => (
            <button
              key={i}
              onClick={() => setSelectedAvatar(url)}
              className={`p-1 rounded-lg transition ${
                selectedAvatar === url
                  ? "bg-pink-500/50 ring-2 ring-pink-500"
                  : "bg-slate-700 hover:bg-slate-600"
              }`}
            >
              <img src={url} alt={`Avatar ${i + 1}`} className="w-full rounded" />
            </button>
          ))}
        </div>
      </div>

      {/* Name Input */}
      <div className="mb-4">
        <label className="text-slate-400 text-sm mb-1 block">Display Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name..."
          maxLength={20}
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-pink-500"
        />
      </div>

      {/* Bio Input */}
      <div className="mb-4">
        <label className="text-slate-400 text-sm mb-1 block">Bio (optional)</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us about yourself..."
          maxLength={100}
          rows={2}
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-pink-500 resize-none"
        />
        <p className="text-slate-500 text-xs mt-1 text-right">{bio.length}/100</p>
      </div>

      {/* Contact Info Section */}
      <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border border-cyan-500/30">
        <p className="text-cyan-400 text-sm font-medium mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Secret Contact Info (revealed only on match)
        </p>

        {/* Telegram */}
        <div className="mb-3">
          <label className="text-slate-400 text-xs mb-1 block">Telegram ID</label>
          <div className="flex items-center">
            <span className="px-3 py-2 bg-slate-600 border border-slate-500 border-r-0 rounded-l-lg text-slate-400 text-sm">@</span>
            <input
              type="text"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value.replace('@', ''))}
              placeholder="your_telegram"
              maxLength={32}
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-500 rounded-r-lg text-white focus:outline-none focus:border-cyan-500 text-sm"
            />
          </div>
        </div>

        {/* Twitter */}
        <div>
          <label className="text-slate-400 text-xs mb-1 block">X (Twitter) ID</label>
          <div className="flex items-center">
            <span className="px-3 py-2 bg-slate-600 border border-slate-500 border-r-0 rounded-l-lg text-slate-400 text-sm">@</span>
            <input
              type="text"
              value={twitterId}
              onChange={(e) => setTwitterId(e.target.value.replace('@', ''))}
              placeholder="your_twitter"
              maxLength={15}
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-500 rounded-r-lg text-white focus:outline-none focus:border-cyan-500 text-sm"
            />
          </div>
        </div>

        <p className="text-slate-500 text-xs mt-3">
          These are encrypted and only revealed when you match with someone.
        </p>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg transition disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Profile"}
      </button>
    </div>
  );
};

// プロフィールを取得（Supabaseから）
export const getProfile = async (address: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("wallet_address", address.toLowerCase())
    .single();

  if (error || !data) return null;
  return data as UserProfile;
};

// プロフィールがあるかチェック
export const hasProfile = async (address: string): Promise<boolean> => {
  const profile = await getProfile(address);
  return profile !== null;
};

// 複数プロフィールを一括取得
export const getProfiles = async (addresses: string[]): Promise<Map<string, UserProfile>> => {
  const lowerAddresses = addresses.map(a => a.toLowerCase());

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("wallet_address", lowerAddresses);

  const map = new Map<string, UserProfile>();
  if (data) {
    for (const profile of data) {
      map.set(profile.wallet_address, profile as UserProfile);
    }
  }
  return map;
};
