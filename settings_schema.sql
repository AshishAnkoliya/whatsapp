-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Privacy
  privacy_last_seen TEXT DEFAULT 'everyone' CHECK (privacy_last_seen IN ('everyone', 'my_contacts', 'nobody')),
  privacy_profile_photo TEXT DEFAULT 'everyone' CHECK (privacy_profile_photo IN ('everyone', 'my_contacts', 'nobody')),
  privacy_about TEXT DEFAULT 'everyone' CHECK (privacy_about IN ('everyone', 'my_contacts', 'nobody')),
  privacy_status TEXT DEFAULT 'my_contacts' CHECK (privacy_status IN ('everyone', 'my_contacts', 'nobody')),
  privacy_read_receipts BOOLEAN DEFAULT true,
  
  -- Chats
  chat_theme TEXT DEFAULT 'system' CHECK (chat_theme IN ('light', 'dark', 'system')),
  chat_enter_is_send BOOLEAN DEFAULT false,
  chat_media_visibility BOOLEAN DEFAULT true,
  chat_font_size TEXT DEFAULT 'medium' CHECK (chat_font_size IN ('small', 'medium', 'large')),
  
  -- Notifications
  notify_message_tone TEXT DEFAULT 'default',
  notify_group_tone TEXT DEFAULT 'default',
  notify_call_ringtone TEXT DEFAULT 'default',
  notify_high_priority BOOLEAN DEFAULT true,
  
  -- Other
  app_language TEXT DEFAULT 'en',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Users can view and edit their own settings
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Optional: Function to auto-create settings when a profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add Trigger to profiles (or auth.users)
DROP TRIGGER IF EXISTS on_profile_created_settings ON public.profiles;
CREATE TRIGGER on_profile_created_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_settings();

-- Realtime Setup
ALTER PUBLICATION supabase_realtime ADD TABLE user_settings;
