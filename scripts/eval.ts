/**
 * Evaluation script for Tara finance-research agent
 * 
 * Tests 20 comprehensive scenarios covering:
 * - Single lookups
 * - Date filtering (specific months, ranges, quarters)
 * - Refunds/reversals
 * - Merchant aliases
 * - Internal transfers
 * - Category comparisons
 * - Recurring subscriptions
 * - No-data/edge cases
 * - Fund period returns & ranking
 * - Holding realised returns
 * - Top merchants by spend
 * - Portfolio value & aggregates
 * - Month-over-month trends
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

interface TestCase {
  id: number;
  question: string;
  category: string;
  notes?: string;
}

const testCases: TestCase[] = [
  // Single lookups
  {
    id: 1,
    question: 'How much did I spend last month?',
    category: 'single_lookup',
    notes: 'Tests date-based aggregation (should use current date context)'
  },
  {
    id: 2,
    question: 'What was my biggest single expense?',
    category: 'single_lookup',
    notes: 'Tests finding max transaction'
  },
  {
    id: 3,
    question: 'How much did I spend on food?',
    category: 'category_lookup',
    notes: 'Tests category filtering and sum aggregation'
  },

  // Date filtering
  {
    id: 4,
    question: 'How much did I spend in January 2024?',
    category: 'date_filtering',
    notes: 'Tests specific month filtering'
  },
  {
    id: 5,
    question: 'What was my spending from February to March 2024?',
    category: 'date_filtering',
    notes: 'Tests date range filtering'
  },

  // Refunds & reversals
  {
    id: 6,
    question: 'Did I have any refunds in my transactions?',
    category: 'refunds',
    notes: 'Tests handling of negative amounts'
  },
  {
    id: 7,
    question: 'What was my net spending (after refunds) on food?',
    category: 'refunds',
    notes: 'Tests subtraction of refunds from totals'
  },

  // Merchant aliases
  {
    id: 8,
    question: 'How much have I spent with Swiggy?',
    category: 'merchant_aliases',
    notes: 'Tests merchant alias resolution (Swiggy vs Swiggy Instamart, etc.)'
  },

  // Internal transfers (should be excluded by default)
  {
    id: 9,
    question: 'What is my total spending (excluding transfers)?',
    category: 'transfers',
    notes: 'Tests filtering out transfer category'
  },

  // Category comparison
  {
    id: 10,
    question: 'Compare my spending on food versus travel. Which grew more?',
    category: 'category_comparison',
    notes: 'Tests multi-step comparison and growth calculation'
  },

  // Recurring subscriptions
  {
    id: 11,
    question: 'Which merchants look like recurring subscriptions?',
    category: 'recurring',
    notes: 'Tests finding merchants with frequent transactions'
  },

  // No data / edge cases
  {
    id: 12,
    question: 'How much did I spend on aerospace equipment?',
    category: 'no_data',
    notes: 'Tests handling of categories with no matches'
  },

  // Fund returns
  {
    id: 13,
    question: 'What was the period return of my mutual funds?',
    category: 'fund_returns',
    notes: 'Tests fund NAV history and period return calculation'
  },

  // Holding returns
  {
    id: 14,
    question: 'What is my realised return on my holdings?',
    category: 'holding_returns',
    notes: 'Tests current NAV vs purchase price calculations'
  },

  // Additional hard cases from assignment
  {
    id: 15,
    question: 'What were my top 5 merchants by spending?',
    category: 'top_merchants',
    notes: 'Tests ranking merchants by total spend'
  },

  {
    id: 16,
    question: 'What is my total portfolio worth today?',
    category: 'portfolio_value',
    notes: 'Tests portfolio aggregate and total gains'
  },

  {
    id: 17,
    question: 'Rank all my mutual funds by one-year return.',
    category: 'fund_ranking',
    notes: 'Tests fund period return ranking'
  },

  {
    id: 18,
    question: 'Did my food spending increase from January to February 2024?',
    category: 'month_over_month',
    notes: 'Tests month-over-month comparison'
  },

  {
    id: 19,
    question: 'How much did I spend on groceries in Q1 2024?',
    category: 'quarterly',
    notes: 'Tests quarterly date range handling'
  },

  {
    id: 20,
    question: 'Which fund gave me the best realised return?',
    category: 'best_fund',
    notes: 'Tests finding best performing holding'
  },
];

async function runTest(testCase: TestCase): Promise<void> {
  console.log(`\n[Test ${testCase.id}] ${testCase.category.toUpperCase()}`);
  console.log(`Question: ${testCase.question}`);
  if (testCase.notes) {
    console.log(`Notes: ${testCase.notes}`);
  }

  try {
    const response = await fetch(`${BASE_URL}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: testCase.question,
      }),
    });

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log(`✓ Answer: ${data.answer.substring(0, 200)}...`);
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function runEvaluation(): Promise<void> {
  console.log('='.repeat(80));
  console.log('TARA FINANCE-RESEARCH AGENT EVALUATION');
  console.log(`Target: ${BASE_URL}`);
  console.log('='.repeat(80));

  // Check health
  try {
    const healthResponse = await fetch(`${BASE_URL}/health`);
    if (!healthResponse.ok) {
      console.error('Server health check failed. Is the server running?');
      process.exit(1);
    }
    console.log('✓ Server is running\n');
  } catch (error) {
    console.error('Cannot connect to server. Is it running on', BASE_URL, '?');
    process.exit(1);
  }

  // Run tests sequentially
  for (const testCase of testCases) {
    await runTest(testCase);
  }

  console.log('\n' + '='.repeat(80));
  console.log('EVALUATION COMPLETE');
  console.log('='.repeat(80));
}

runEvaluation().catch((error) => {
  console.error('Evaluation failed:', error);
  process.exit(1);
});
