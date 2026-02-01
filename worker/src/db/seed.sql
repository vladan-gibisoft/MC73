-- MC73 Generator Uplatnica - Seed Data
-- Run after schema.sql: wrangler d1 execute mc73-db --file=./src/db/seed.sql

-- Default admin user (password: Admin123!)
-- bcryptjs hash of 'Admin123!' with 10 rounds
INSERT OR IGNORE INTO users (id, email, password_hash, name, is_admin, is_user)
VALUES (
  1,
  'admin@zgrada.local',
  '$2a$10$Br.lKimdXpnfNdBfdetHy.Q.7xo.e3/vuEJ31PXV7RLXYlOYRPno2',
  'Administrator',
  1,
  1
);

-- Note: The password hash above is a placeholder.
-- Generate a real hash using: node -e "require('bcryptjs').hash('Admin123!', 10).then(console.log)"
-- Then update this file with the correct hash.
