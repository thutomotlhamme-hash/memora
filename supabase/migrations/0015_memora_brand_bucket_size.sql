-- Logos are prepared in the browser (trimmed, print-sized PNG), but allow room
-- for detailed ones: up to 5 MB.
update storage.buckets set file_size_limit = 5242880 where id = 'memora-brand';
