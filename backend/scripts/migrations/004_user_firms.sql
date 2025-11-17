-- User to firm access mapping for secure firm switching
CREATE TABLE IF NOT EXISTS user_firms (
  user_id INT NOT NULL,
  firm_id INT NOT NULL,
  PRIMARY KEY (user_id, firm_id),
  CONSTRAINT fk_uf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uf_firm FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE
);

