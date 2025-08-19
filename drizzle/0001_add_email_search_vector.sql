CREATE INDEX email_search_idx ON emails USING GIN (search_vector);

CREATE FUNCTION update_email_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body_text, '')), 'B');
  RETURN NEW;
END
$$ language plpgsql;

CREATE TRIGGER emails_search_update
BEFORE INSERT OR UPDATE ON emails
FOR EACH ROW EXECUTE FUNCTION update_email_search_vector();

DROP TRIGGER IF EXISTS emails_search_update ON emails;
DROP FUNCTION IF EXISTS update_email_search_vector;
DROP INDEX IF EXISTS email_search_idx;