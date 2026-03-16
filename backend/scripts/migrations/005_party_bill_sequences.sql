-- Strict bill number allocator per firm + FY.
-- Keeps bill numbers sequential and concurrency-safe for auto-assigned bills.

CREATE TABLE IF NOT EXISTS party_bill_sequences (
  firm_id INT NOT NULL,
  fiscal_year_id INT NOT NULL,
  next_no BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (firm_id, fiscal_year_id),
  CONSTRAINT fk_pbs_firm FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE,
  CONSTRAINT fk_pbs_fy FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO party_bill_sequences (firm_id, fiscal_year_id, next_no)
SELECT
  firm_id,
  fiscal_year_id,
  COALESCE(
    MAX(
      CASE
        WHEN bill_no REGEXP '^[0-9]+$' THEN CAST(bill_no AS UNSIGNED)
        ELSE 0
      END
    ),
    0
  ) + 1 AS next_no
FROM party_bills
WHERE fiscal_year_id IS NOT NULL
GROUP BY firm_id, fiscal_year_id
ON DUPLICATE KEY UPDATE next_no = GREATEST(party_bill_sequences.next_no, VALUES(next_no));
