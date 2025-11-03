-- Baseline schema for NutriChain (idempotent). Created with production-friendly defaults.
-- This file sets up all core tables with foreign keys and indexes.

-- Firms
CREATE TABLE IF NOT EXISTS firms (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  address TEXT NULL,
  gst_no VARCHAR(32) NULL,
  UNIQUE KEY uniq_firms_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fiscal years
CREATE TABLE IF NOT EXISTS fiscal_years (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_fy_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products
CREATE TABLE IF NOT EXISTS products (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(16) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  hsn_code VARCHAR(32) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uniq_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Parties (global catalog; firm_id NULL means global)
CREATE TABLE IF NOT EXISTS parties (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role ENUM('BUYER','SELLER','BOTH') NOT NULL DEFAULT 'BOTH',
  firm_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  address TEXT NULL,
  contact VARCHAR(100) NULL,
  gst_no VARCHAR(20) NULL,
  gst_type ENUM('INTRA','INTER') DEFAULT 'INTRA',
  cgst_rate DECIMAL(5,2) DEFAULT 0.00,
  sgst_rate DECIMAL(5,2) DEFAULT 0.00,
  igst_rate DECIMAL(5,2) DEFAULT 0.00,
  due_days INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_parties_firm_role (firm_id, role),
  CONSTRAINT fk_parties_firm FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Party emails
CREATE TABLE IF NOT EXISTS party_emails (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  party_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  UNIQUE KEY uq_party_email (party_id, email),
  KEY fk_party_email_party (party_id),
  CONSTRAINT fk_party_email_party FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  firm_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_username (username),
  KEY idx_users_firm (firm_id),
  CONSTRAINT fk_users_firm FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contracts (Order Confirm)
CREATE TABLE IF NOT EXISTS contracts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  contract_no VARCHAR(100) NULL,
  order_date DATE NOT NULL,
  product_id INT NOT NULL,
  firm_id INT NOT NULL,
  fiscal_year_id INT NOT NULL,
  seller_id INT NOT NULL,
  buyer_id INT NOT NULL,
  seller_brokerage DECIMAL(10,2) NULL,
  buyer_brokerage DECIMAL(10,2) NULL,
  delivery_station VARCHAR(255) NULL,
  delivery_schedule VARCHAR(255) NULL,
  status VARCHAR(50) NULL,
  payment_criteria VARCHAR(255) NULL,
  terms TEXT NULL,
  min_qty DECIMAL(14,3) NULL,
  max_qty DECIMAL(14,3) NULL,
  unit VARCHAR(20) NULL,
  price DECIMAL(14,2) NULL,
  deleted_at DATETIME NULL,
  mailed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_contracts_fy (fiscal_year_id),
  KEY idx_contracts_seller (seller_id),
  KEY idx_contracts_buyer (buyer_id),
  KEY idx_contracts_product (product_id),
  KEY idx_contracts_firm_fy (firm_id, fiscal_year_id),
  KEY idx_contracts_firm_fy_date (firm_id, fiscal_year_id, order_date),
  KEY idx_contracts_deleted_at (deleted_at),
  CONSTRAINT fk_contracts_firm FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_fy FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_seller FOREIGN KEY (seller_id) REFERENCES parties(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_buyer FOREIGN KEY (buyer_id) REFERENCES parties(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Party bills
CREATE TABLE IF NOT EXISTS party_bills (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  firm_id INT NOT NULL,
  fiscal_year_id INT NULL,
  party_id INT NOT NULL,
  bill_no VARCHAR(64) NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  bill_date DATE NOT NULL,
  brokerage DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  mailed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bill_firm_fy_no (firm_id, fiscal_year_id, bill_no),
  KEY idx_party_bills_firm (firm_id),
  KEY idx_party_bills_fy (fiscal_year_id),
  KEY idx_party_bills_party (party_id),
  KEY idx_party_bills_firm_fy_date (firm_id, fiscal_year_id, bill_date),
  CONSTRAINT fk_pb_firm FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pb_fy FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id) ON DELETE SET NULL,
  CONSTRAINT fk_pb_party FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Party bill receipts
CREATE TABLE IF NOT EXISTS party_bill_receipts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  firm_id INT NOT NULL,
  party_bill_id BIGINT NOT NULL,
  party_id INT NOT NULL,
  receive_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  mode VARCHAR(20) NULL,
  reference_no VARCHAR(100) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pbr_bill_date (firm_id, party_bill_id, receive_date),
  CONSTRAINT fk_pbr_bill FOREIGN KEY (party_bill_id) REFERENCES party_bills(id) ON DELETE CASCADE,
  CONSTRAINT fk_pbr_party FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pbr_firm FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

