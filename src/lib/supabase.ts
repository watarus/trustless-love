import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Profile型定義
export interface UserProfile {
  wallet_address: string;
  name: string;
  bio: string | null;
  image_url: string;
  telegram_id: string | null;
  twitter_id: string | null;
  created_at?: string;
  updated_at?: string;
}

// 全プロフィールを取得（自分以外）
export const getAllProfiles = async (excludeAddress?: string): Promise<UserProfile[]> => {
  let query = supabase.from("profiles").select("*");

  if (excludeAddress) {
    query = query.neq("wallet_address", excludeAddress.toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch profiles:", error);
    return [];
  }

  return data || [];
};
