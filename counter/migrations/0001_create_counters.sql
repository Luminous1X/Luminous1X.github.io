-- One row per counter; the site uses the one named 'views'.
CREATE TABLE IF NOT EXISTS counters (
	name TEXT PRIMARY KEY,
	n INTEGER NOT NULL DEFAULT 0
);
