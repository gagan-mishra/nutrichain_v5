-- Align schema on older databases that may pre-date baseline additions.
-- 1) Ensure parties.due_days exists
SET @has_due := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'parties' AND COLUMN_NAME = 'due_days'
);
SET @sql_due := IF(@has_due = 0, 'ALTER TABLE parties ADD COLUMN due_days INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_due;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Ensure party_bill_receipts FKs exist (safe no-op if already there)
SET @has_fk_bill := (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_pbr_bill'
);
SET @sql_fk_bill := IF(@has_fk_bill = 0,
  'ALTER TABLE party_bill_receipts ADD CONSTRAINT fk_pbr_bill FOREIGN KEY (party_bill_id) REFERENCES party_bills(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql_fk_bill;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk_party := (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_pbr_party'
);
SET @sql_fk_party := IF(@has_fk_party = 0,
  'ALTER TABLE party_bill_receipts ADD CONSTRAINT fk_pbr_party FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt FROM @sql_fk_party;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk_firm := (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_pbr_firm'
);
SET @sql_fk_firm := IF(@has_fk_firm = 0,
  'ALTER TABLE party_bill_receipts ADD CONSTRAINT fk_pbr_firm FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt FROM @sql_fk_firm;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
