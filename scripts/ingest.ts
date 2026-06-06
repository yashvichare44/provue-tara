import * as fs from 'fs';
import * as path from 'path';
import { initializeSchema, clearAllData } from '../src/db/schema.js';
import { query } from '../src/db/connection.js';
import * as dotenv from 'dotenv';

dotenv.config();

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  memo: string;
}

interface Fund {
  id: string;
  name: string;
  category: string;
  nav_history: { date: string; value: number }[];
}

interface Holding {
  fund_id: string;
  fund_name: string;
  units: number;
  purchase_date: string;
  purchase_nav: number;
}

async function inferMerchantAliases(merchants: string[]): Promise<Map<string, string>> {
  const aliases = new Map<string, string>();

  // Group merchants by similarity (simple approach: common prefixes)
  const groups: Map<string, string[]> = new Map();

  for (const merchant of merchants) {
    const normalizedKey = merchant.toUpperCase().split(/[\s*]/)[0]; // First word
    if (!groups.has(normalizedKey)) {
      groups.set(normalizedKey, []);
    }
    groups.get(normalizedKey)!.push(merchant);
  }

  // For each group, pick the most common/shortest as canonical
  for (const [, variants] of groups) {
    if (variants.length > 1) {
      // Sort by length (shorter names are often canonical) then alphabetically
      const canonical = variants.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
      for (const variant of variants) {
        if (variant !== canonical) {
          aliases.set(variant, canonical);
        }
      }
    }
  }

  return aliases;
}

async function ingestData(dataDir: string) {
  console.log(`Starting data ingestion from: ${dataDir}`);

  // Initialize schema
  await initializeSchema();

  // Clear existing data to ensure clean slate
  await clearAllData();

  // Re-initialize schema
  await initializeSchema();

  // Load transactions.json
  const transactionsPath = path.join(dataDir, 'transactions.json');
  const transactions: Transaction[] = JSON.parse(fs.readFileSync(transactionsPath, 'utf-8'));

  // Load funds.json
  const fundsPath = path.join(dataDir, 'funds.json');
  const funds: Fund[] = JSON.parse(fs.readFileSync(fundsPath, 'utf-8'));

  // Load holdings.json
  const holdingsPath = path.join(dataDir, 'holdings.json');
  const holdings: Holding[] = JSON.parse(fs.readFileSync(holdingsPath, 'utf-8'));

  console.log(`Loaded ${transactions.length} transactions, ${funds.length} funds, ${holdings.length} holdings`);

  // Infer merchant aliases
  const merchantNames = [...new Set(transactions.map(t => t.merchant))];
  const merchantAliases = await inferMerchantAliases(merchantNames);
  console.log(`Inferred ${merchantAliases.size} merchant aliases`);

  // Insert transactions
  for (const tx of transactions) {
    // Normalize merchant using aliases
    const canonicalMerchant = merchantAliases.get(tx.merchant) || tx.merchant;

    await query(
      `INSERT INTO transactions (date, merchant, category, amount, currency, memo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tx.date, canonicalMerchant, tx.category || 'uncategorized', tx.amount, tx.currency || 'INR', tx.memo || '']
    );
  }
  console.log(`Inserted ${transactions.length} transactions`);

  // Insert funds and their NAV history
  for (const fund of funds) {
    await query(
      `INSERT INTO funds (id, name, category) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [fund.id, fund.name, fund.category]
    );

    // Insert NAV history
    for (const nav of fund.nav_history) {
      await query(
        `INSERT INTO fund_nav (fund_id, nav_date, nav_value) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [fund.id, nav.date, nav.value]
      );
    }
  }
  console.log(`Inserted ${funds.length} funds with NAV history`);

  // Insert holdings
  for (const holding of holdings) {
    await query(
      `INSERT INTO holdings (fund_id, fund_name, units, purchase_date, purchase_nav)
       VALUES ($1, $2, $3, $4, $5)`,
      [holding.fund_id, holding.fund_name, holding.units, holding.purchase_date, holding.purchase_nav]
    );
  }
  console.log(`Inserted ${holdings.length} holdings`);

  // Insert merchant aliases for reference
  for (const [alias, canonical] of merchantAliases) {
    await query(
      `INSERT INTO merchant_aliases (canonical_name, alias) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [canonical, alias]
    );
  }
  console.log(`Inserted ${merchantAliases.size} merchant aliases`);

  console.log('Data ingestion completed successfully');
  process.exit(0);
}

const dataDir = process.env.DATA_DIR || './data/sample_a';

if (!fs.existsSync(dataDir)) {
  console.error(`Data directory not found: ${dataDir}`);
  process.exit(1);
}

ingestData(dataDir).catch(error => {
  console.error('Ingestion failed:', error);
  process.exit(1);
});
