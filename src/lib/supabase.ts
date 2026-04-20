import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);

export type Profile = {
  id: string;
  username: string;
  avatar_url: string;
  status: string;
  last_seen: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  type: 'group' | 'dm';
  created_at: string;
  created_by: string;
  // UI helper fields
  last_message?: string;
  last_message_time?: string;
  last_sender_name?: string;
  last_message_type?: string;
  unread_count?: number;
};

export type Message = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'document' | 'system';
  file_url?: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
  reply_to?: {
    sender_name: string;
    content: string;
  };
  reactions?: {
    [emoji: string]: string[]; // emoji -> list of user_ids
  };
  read_by?: string[]; // list of user_ids who have read the message
  delivered_to?: string[]; // list of user_ids who have received the message
  is_deleted?: boolean;
  edited_at?: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
};
