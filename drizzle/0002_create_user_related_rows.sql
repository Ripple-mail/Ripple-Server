CREATE OR REPLACE FUNCTION create_user_related_rows()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id);
  INSERT INTO mailboxes (user_id, name, mailbox_type, system_mailbox)
  VALUES
    (NEW.id, 'Inbox', 'inbox', true),
    (NEW.id, 'Sent', 'sent', true),
    (NEW.id, 'Drafts', 'draft', true),
    (NEW.id, 'Trash', 'trash', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS after_user_insert ON users;--> statement-breakpoint
CREATE TRIGGER after_user_insert
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_user_related_rows();