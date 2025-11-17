-- Enforce one bill per party per FY at the database level (optional but recommended).
-- Creates a unique index on (firm_id, fiscal_year_id, party_id) if it does not exist.

SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'party_bills'
    AND INDEX_NAME = 'uq_bill_firm_fy_party'
);

SET @sql := IF(@has_idx = 0,
  'CREATE UNIQUE INDEX uq_bill_firm_fy_party ON party_bills(firm_id, fiscal_year_id, party_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
