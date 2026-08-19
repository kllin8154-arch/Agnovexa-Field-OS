ALTER TABLE projects ADD COLUMN profile_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN technologies_json TEXT NOT NULL DEFAULT '[]';
