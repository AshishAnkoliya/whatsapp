-- SQL Schema for WhatsApp Pro Chat Application

-- 0. Clean Setup (Drop existing tables to recreate perfectly)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Profiles Table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  avatar_url TEXT,
  status TEXT DEFAULT 'Hey there! I am using WhatsApp Pro.',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Groups Table
CREATE TABLE groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  created_by UUID REFERENCES profiles(id)
);

-- 3. Group Members Table
CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (group_id, user_id)
);

-- 4. Messages Table
CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'document')),
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  reply_to JSONB DEFAULT NULL,
  reactions JSONB DEFAULT '{}'::jsonb,
  read_by JSONB DEFAULT '[]'::jsonb,
  sender_name TEXT,
  sender_avatar TEXT
);

-- 5. Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Groups Policies
CREATE POLICY "Everyone can view groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Group creators can update their groups" ON groups FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Group creators can delete their groups" ON groups FOR DELETE USING (created_by = auth.uid());

-- Group Members Policies
CREATE POLICY "Everyone can view group members" ON group_members FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join groups" ON group_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Group members can leave or admins can manage" ON group_members FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM group_members adm WHERE adm.group_id = group_members.group_id AND adm.user_id = auth.uid() AND adm.role = 'admin'));

-- Messages Policies
CREATE POLICY "Members can view messages" ON messages FOR SELECT 
USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = messages.group_id AND gm.user_id = auth.uid()));

CREATE POLICY "Members can insert messages" ON messages FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = messages.group_id AND gm.user_id = auth.uid()));

CREATE POLICY "Message sender can delete their message" ON messages FOR DELETE USING (sender_id = auth.uid());
CREATE POLICY "Message sender or members can update (reactions)" ON messages FOR UPDATE USING (EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = messages.group_id AND gm.user_id = auth.uid()));

-- Realtime Setup
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE groups;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;

-- 6. Trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Storage Bucket Setup & Policies (For Avatars & Chat Media)
-- You must run these manually in the SQL Editor if buckets don't exist
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public media is accessible by everyone" ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');
CREATE POLICY "Authenticated users can upload media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own media" ON storage.objects FOR UPDATE USING (bucket_id = 'chat-media' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own media" ON storage.objects FOR DELETE USING (bucket_id = 'chat-media' AND auth.uid() = owner);

-- 8. Add is_deleted to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 9. Starred Messages Table
CREATE TABLE IF NOT EXISTS starred_messages (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, message_id)
);

ALTER TABLE starred_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own starred messages" ON starred_messages FOR ALL USING (user_id = auth.uid());

-- 10. Add delivered_to to messages for tracking double ticks
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_to UUID[] DEFAULT '{}';
