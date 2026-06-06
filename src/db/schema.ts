import { query } from './connection.js';

export async function initializeSchema() {
  // Create transactions table
  await query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      merchant VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      amount NUMERIC(12, 2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'INR',
      memo TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index on date for efficient date-based queries
  await query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)
  `);

  // Create index on merchant for merchant searches
  await query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant)
  `);

  // Create index on category for category filtering
  await query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)
  `);

  // Create composite index for common queries
  await query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date_category ON transactions(date, category)
  `);

  // Create funds table
  await query(`
    CREATE TABLE IF NOT EXISTS funds (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create fund_nav table for historical NAV data
  await query(`
    CREATE TABLE IF NOT EXISTS fund_nav (
      id SERIAL PRIMARY KEY,
      fund_id VARCHAR(50) NOT NULL,
      nav_date DATE NOT NULL,
      nav_value NUMERIC(12, 6) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fund_id) REFERENCES funds(id),
      UNIQUE(fund_id, nav_date)
    )
  `);

  // Create index on fund_id and nav_date for efficient NAV lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_fund_nav_fund_date ON fund_nav(fund_id, nav_date)
  `);

  // Create holdings table
  await query(`
    CREATE TABLE IF NOT EXISTS holdings (
      id SERIAL PRIMARY KEY,
      fund_id VARCHAR(50) NOT NULL,
      fund_name VARCHAR(255) NOT NULL,
      units NUMERIC(12, 6) NOT NULL,
      purchase_date DATE NOT NULL,
      purchase_nav NUMERIC(12, 6) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fund_id) REFERENCES funds(id)
    )
  `);

  // Create index on fund_id for holdings lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_holdings_fund_id ON holdings(fund_id)
  `);

  // Create merchant_aliases table for storing inferred aliases
  await query(`
    CREATE TABLE IF NOT EXISTS merchant_aliases (
      id SERIAL PRIMARY KEY,
      canonical_name VARCHAR(255) NOT NULL,
      alias VARCHAR(255) NOT NULL,
      UNIQUE(canonical_name, alias)
    )
  `);

  console.log('Schema initialized successfully');
}

export async function clearAllData() {
  // Drop tables in order of foreign key dependencies
  await query('DROP TABLE IF EXISTS merchant_aliases');
  await query('DROP TABLE IF EXISTS fund_nav');
  await query('DROP TABLE IF EXISTS holdings');
  await query('DROP TABLE IF EXISTS funds');
  await query('DROP TABLE IF EXISTS transactions');
  console.log('All data cleared successfully');
}
