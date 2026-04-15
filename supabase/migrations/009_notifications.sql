-- Notification queue shared between ipl-fantasy (writer) and banteragent (reader/sender)
-- banteragent polls this table every minute and sends unsent rows to WhatsApp

CREATE TABLE IF NOT EXISTS ba_notifications (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id    text        NOT NULL,
  message     text        NOT NULL,
  sent_at     timestamptz,                       -- NULL = pending, non-NULL = sent
  created_at  timestamptz DEFAULT now()
);

-- Index for the poll query (unsent notifications for a group)
CREATE INDEX IF NOT EXISTS ba_notifications_unsent
  ON ba_notifications (group_id, created_at)
  WHERE sent_at IS NULL;

-- Auto-delete notifications older than 24 hours (cleanup — cron or any insert triggers it)
-- banteragent itself also prunes after sending, but this is a safety net.
