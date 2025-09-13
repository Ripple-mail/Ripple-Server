CREATE EXTENSION IF NOT EXISTS pg_cron;--> statement-breakpoint
SELECT cron.schedule(
  'soft_delete_old_rows',
  '0 0 * * *',
  $$UPDATE user_emails
    SET deleted_at = NOW()
    WHERE deleted_at IS NULL
      AND trash_since IS NOT NULL
      AND trash_since < NOW() - INTERVAL '30 days';$$
);