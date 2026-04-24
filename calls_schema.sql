-- calls_schema.sql

-- 1. Create the calls table
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('audio', 'video')),
    status VARCHAR(20) NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'ongoing', 'rejected', 'ended', 'missed')),
    sdp_offer JSONB,    -- Optional: if you need to pass SDP manually (though we're using PeerJS, so this might not be strictly needed, but good for custom signaling)
    sdp_answer JSONB,   -- Optional
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    CONSTRAINT caller_not_receiver CHECK (caller_id != receiver_id)
);

-- 2. Add Row Level Security (RLS)
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Users can read their own calls (where they are caller or receiver)
CREATE POLICY "Users can view their own calls"
ON calls FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Callers can insert new calls
CREATE POLICY "Users can initiate calls"
ON calls FOR INSERT
WITH CHECK (auth.uid() = caller_id);

-- Both caller and receiver can update the call status
CREATE POLICY "Participants can update call status"
ON calls FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- 4. Enable Realtime for the calls table
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
