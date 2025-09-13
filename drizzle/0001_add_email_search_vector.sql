CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
DROP TRIGGER IF EXISTS emails_search_update ON emails;--> statement-breakpoint
DROP FUNCTION IF EXISTS update_email_search_vector;--> statement-breakpoint
CREATE FUNCTION update_email_search_vector() RETURNS trigger AS $$
DECLARE
  rcpts_text text;
BEGIN
  SELECT string_agg(address, ' ')
    INTO rcpts_text
    FROM recipients
    WHERE email_id = NEW.id;
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.from_address, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(rcpts_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body_text, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER emails_search_update
BEFORE INSERT OR UPDATE ON emails
FOR EACH ROW EXECUTE FUNCTION update_email_search_vector();--> statement-breakpoint
DROP FUNCTION IF EXISTS refresh_email_search_vector();--> statement-breakpoint
CREATE FUNCTION refresh_email_search_vector() RETURNS trigger AS $$
BEGIN
  UPDATE emails
  SET search_vector = (
    setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.from_address, '')), 'A') ||
    setweight(to_tsvector('english', coalesce((SELECT string_agg(address, ' ') FROM recipients WHERE email_id = emails.id), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body_text, '')), 'C')
  )
  WHERE id = COALESCE(NEW.email_id, OLD.email_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS recipients_search_update ON recipients;--> statement-breakpoint
CREATE TRIGGER recipients_search_update
AFTER INSERT OR UPDATE OR DELETE ON recipients
FOR EACH ROW EXECUTE FUNCTION refresh_email_search_vector();--> statement-breakpoint
DROP INDEX IF EXISTS email_search_idx;--> statement-breakpoint
CREATE INDEX email_search_idx ON emails USING GIN (search_vector);--> statement-breakpoint
DROP INDEX IF EXISTS email_subject_trgm_idx;--> statement-breakpoint
CREATE INDEX email_subject_trgm_idx ON emails USING GIN (subject gin_trgm_ops);--> statement-breakpoint
DROP INDEX IF EXISTS email_from_trgm_idx;--> statement-breakpoint
CREATE INDEX email_from_trgm_idx ON emails USING GIN (from_address gin_trgm_ops);--> statement-breakpoint
DROP INDEX IF EXISTS email_to_trgm_idx;--> statement-breakpoint
CREATE INDEX email_to_trgm_idx ON recipients USING GIN (address gin_trgm_ops);--> statement-breakpoint