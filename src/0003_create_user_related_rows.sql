CREATE OR REPLACE FUNCTION create_user_related_rows()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id);
  INSERT INTO mailboxes (user_id, name, mailboxType, systemMailbox)
  VALUES
    (NEW.id, 'Inbox', 'inbox', true),
    (NEW.id, 'Sent', 'inbox', true),
    (NEW.id, 'Drafts', 'inbox', true),
    (NEW.id, 'Trash', 'inbox', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER after_user_insert--> statement-breakpoint
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_related_rows();