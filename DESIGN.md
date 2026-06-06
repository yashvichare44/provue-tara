# Tara Finance-Research Agent — Design Document

## Overview

Tara is a personal finance-research agent built on Mastra that helps users understand their spending patterns, investment returns, and portfolio performance through natural language queries backed by real database queries.

## Architecture

### 1. Data Layer

#### Schema Design

```
transactions
├── id (PK)
├── date (indexed)
├── merchant (indexed, with alias resolution)
├── category (indexed)
├── amount (can be negative for refunds)
├── currency
├── memo (raw/noisy transaction data)
└── timestamps

funds
├── id (PK)
├── name
├── category
└── timestamps

fund_nav (historical market data)
├── id (PK)
├── fund_id (FK, indexed with nav_date)
├── nav_date
├── nav_value
└── unique constraint (fund_id, nav_date)

holdings (user's portfolio)
├── id (PK)
├── fund_id (FK)
├── fund_name
├── units
├── purchase_date
├── purchase_nav
└── timestamps

merchant_aliases
├── id (PK)
├── canonical_name (inferred from data, not hardcoded)
├── alias
└── unique constraint (canonical_name, alias)
```

#### Key Design Decisions

1. **Merchant Alias Resolution**: Aliases are inferred programmatically during ingestion by grouping merchants by their first word in uppercase (case-insensitive). This ensures the system doesn't hardcode merchant names and adapts to new data.

2. **Amount Handling**: 
   - Negative amounts represent refunds/reversals
   - By default, aggregation excludes transfers (category = 'transfer')
   - Tools can optionally include/exclude refunds based on the question

3. **Date Handling**: 
   - All dates stored as ISO 8601 (YYYY-MM-DD) for consistency
   - Relative date queries (e.g., "last month") are parsed by the agent based on question context
   - Assumption: "last month" means the previous calendar month from today

4. **Indexing Strategy**:
   - Primary indexes: date, merchant, category (most common filters)
   - Composite index: (date, category) for combined queries
   - Fund NAV indexed by (fund_id, nav_date) for efficient historical lookups

### 2. Tool Layer

Eight specialized tools handle different aspects of financial queries:

#### Tool 1: `query_transactions`
- **Purpose**: Flexible transaction querying with filtering and aggregation
- **Filters**: date range, category (partial match), merchant (partial match)
- **Aggregation**: sum, avg, count, or raw rows
- **Output**: Rows or aggregated results
- **Grounding**: Always queries database, never returns model guesses

#### Tool 2: `compare_spending`
- **Purpose**: Multi-category comparisons for trend analysis
- **Inputs**: Array of categories, optional date range
- **Output**: Per-category totals, counts, averages
- **Use Case**: "Compare food vs travel spending"

#### Tool 3: `merchant_spending`
- **Purpose**: Detailed merchant analysis
- **Output**: Total spent, frequency, average transaction, date range
- **Handles**: Merchant partial matches (resolves aliases)
- **Use Case**: "How much have I spent with Swiggy?"

#### Tool 4: `monthly_spending`
- **Purpose**: Trend analysis via monthly aggregation
- **Output**: Per-month totals, counts, averages
- **Filters**: Optional category or merchant filter
- **Use Case**: "Show my spending trend month-over-month"

#### Tool 5: `find_recurring`
- **Purpose**: Identify recurring subscriptions
- **Logic**: Merchants with ≥3 transactions with low variance (default 25%)
- **Formula**: Variance = STDDEV(amounts) / AVG(amount)
- **Output**: Frequency, typical amount, standard deviation, date range
- **Use Case**: "Which merchants look like recurring subscriptions?"

#### Tool 6: `portfolio_value`
- **Purpose**: Calculate total portfolio value and all-in gains
- **Formula**: 
  - Per holding: Current Value = units × current_NAV
  - Portfolio: Sum of all holdings' current values
  - Gain = Current Value - Purchase Value
  - Return % = (Gain / Purchase Value) × 100%
- **Output**: Holdings breakdown + aggregated totals (invested, current, gain, %)
- **Parameters**: Optional `asOf` date (defaults to latest NAV)
- **Use Case**: "What is my portfolio worth and how much have I made?"

#### Tool 7: `fund_period_return`
- **Purpose**: Calculate fund performance over a period
- **Formula**: (NAV_end - NAV_start) / NAV_start × 100%
- **Output**: Start/end NAV values, percentage return
- **Note**: Period return = fund's performance, not user's personal return
- **Use Case**: "What was the return of Tech Index Fund between Jan 2024 and Mar 2025?"

#### Tool 8: `holding_realised_return`
- **Purpose**: Calculate user's actual return on a single holding
- **Formula**: (Current Value - Purchase Value) / Purchase Value × 100%
  - Where Current Value = units × current_NAV
  - Where Purchase Value = units × purchase_NAV
- **Output**: Invested amount, current value, gain/loss, return percentage
- **Note**: User-specific; differs from fund period return
- **Use Case**: "What's my return on my Gold Fund holding?"

### 3. Agent Layer

#### Tara Agent Configuration

- **Model**: OpenAI gpt-4o-mini (configurable via `LLM_PROVIDER` and `LLM_MODEL`)
- **System Prompt**: Emphasizes grounding, precision, multi-step orchestration
- **Tool Selection**: Model decides which tools to call based on question intent

#### Orchestration Strategy

1. **Single-tool queries**: Straightforward lookups use one tool
   - Example: "How much did I spend on food?" → `query_transactions` with category filter

2. **Multi-tool queries**: Complex questions call tools sequentially
   - Example: "Compare food vs travel, which grew faster?"
   - Calls: `monthly_spending` for food + `monthly_spending` for travel → compute growth rates

3. **No-data handling**: Agent explicitly states when data is unavailable
   - Does not invent numbers
   - Example: "I don't have transactions for 'aerospace equipment' in your data"

### 4. Data Ingestion

#### Ingest Script (`scripts/ingest.ts`)

- **Input**: `DATA_DIR` environment variable pointing to snapshot folder
- **Process**:
  1. Initialize Postgres schema (idempotent)
  2. Clear existing data (fresh start for each snapshot)
  3. Load transactions.json, funds.json, holdings.json
  4. Infer merchant aliases from transaction data
  5. Insert all data with normalized merchant names
  6. Create merchant_aliases reference table

- **Merchant Alias Inference**:
  - Groups merchants by first word (case-insensitive)
  - Selects shortest variant as canonical name
  - Stores all variants in merchant_aliases table
  - Examples:
    - "Swiggy" + "Swiggy Instamart" + "SWIGGY*ORDER" → canonical: "Swiggy"
    - "Apollo Pharmacy" + "Apollo Labs" → canonical: "Apollo Labs" (shorter)

- **Invocation**: `DATA_DIR=./data/sample_a npx tsx scripts/ingest.ts`

### 5. HTTP API Layer

#### Endpoint: POST /ask

**Request**:
```json
{
  "question": "How much did I spend on food last month?"
}
```

**Response**:
```json
{
  "answer": "Based on your transaction data, you spent ₹X,XXX.XX on food in February 2024...",
  "question": "How much did I spend on food last month?"
}
```

#### Error Handling

- 400: Invalid request (missing or malformed question)
- 500: Server error (database, model API, or orchestration failure)
- All errors include descriptive messages for debugging

### 6. Key Design Tradeoffs

#### Grounding Over Flexibility
- **Decision**: All numbers come from database queries
- **Tradeoff**: Cannot reason about data the model hasn't queried
- **Rationale**: Financial accuracy is non-negotiable; better to say "I don't know" than guess

#### Tool Specificity
- **Decision**: 7 focused tools instead of a single "query builder"
- **Tradeoff**: Requires the model to select the right tool; more tokens per turn
- **Rationale**: Reduces ambiguity and improves model's accuracy in financial contexts

#### Synchronous Tool Execution
- **Decision**: All tools run synchronously (no async queue)
- **Tradeoff**: Slow tools (e.g., complex fund return calculations) block the request
- **Rationale**: For this dataset size (~1500 transactions, 8 funds), latency is <500ms; acceptable UX
- **Future**: Can add async queue (BullMQ) if needed (milestone 6 in assignment)

#### Merchant Alias Inference
- **Decision**: Programmatic inference, not hardcoded lists
- **Tradeoff**: May miss aliases if the pattern is unusual
- **Rationale**: Generalizes to unseen data; doesn't memorize sample data

#### Relative Date Assumptions
- **Decision**: "Last month" = previous calendar month from today
- **Tradeoff**: Ambiguous for edge cases (e.g., first day of month)
- **Rationale**: Clear, consistent; agent can clarify if needed

### 7. Data Complications Handled

| Complication | Strategy |
|---|---|
| **Refunds** | Stored as negative amounts; excluded from spend by default; can be included if question asks |
| **Merchant Aliases** | Grouped by first word during ingestion; resolved via `canonical_name` in queries |
| **Internal Transfers** | Category = 'transfer'; excluded from spend aggregations by default |
| **Date Boundaries** | Stored as DATE; relative dates clarified in agent's system prompt |
| **Noisy Memos** | Treated as untrusted data; not used for filtering; kept for reference |
| **Missing Categories** | Stored as 'uncategorized'; still queryable by merchant or date |
| **Fund vs Holding Returns** | Separate tools: `fund_period_return` (market data) vs `holding_realised_return` (user-specific) |

### 8. Testing & Evaluation

#### Evaluation Script (`scripts/eval.ts`)

- 14 test cases covering:
  - Single lookups (biggest expense, monthly total)
  - Category queries (spending on food)
  - Date filtering (specific months, ranges)
  - Refunds (negative amounts)
  - Merchant aliases (Swiggy variations)
  - Internal transfers (exclusion)
  - Category comparison (food vs travel)
  - Recurring detection
  - No-data cases
  - Fund period returns
  - Holding realised returns

- **Invocation**: `npm run eval` (configured in package.json)
- **Output**: Pass/fail for each test, partial answer text for validation

#### Sample Data Quality

Three snapshots (sample_a, sample_b, sample_c) with:
- Different merchants (Zepto, Apollo in A; different vendors in B/C)
- Different memo styles (UPI-based in A; NEFT-based in C)
- Realistic complications (refunds, transfers, missing categories, aliases)

### 9. Deployment Considerations

#### Environment Variables

- `DATABASE_URL`: Postgres connection string (default: `postgres://postgres:postgres@localhost:5432/provue_tara`)
- `LLM_PROVIDER`: OpenAI, Anthropic, Google, etc.
- `LLM_MODEL`: Model name (default: `gpt-4o-mini`)
- `PORT`: HTTP server port (default: 3000)

#### Database Initialization

- Schema is auto-created on startup (idempotent with `IF NOT EXISTS`)
- Ingest script clears and repopulates data (safe for CI/CD)

#### Scaling Considerations

- **Current**: Synchronous, single-threaded
- **Bottleneck**: Fund return calculations (loops over NAV history)
- **Future**: Async queue for slow operations, caching of NAV history aggregates

### 10. Known Limitations

1. **Relative Dates**: Only "last month" is supported; "Q1 2024" or "past 90 days" require agent-level parsing
2. **Multi-currency**: Stored but not converted; all queries assume INR
3. **Partial Merchant Matches**: Case-insensitive but substring-based; "Swiggy" matches "Swiggy Instamart" and vice versa
4. **No Forecast**: Cannot predict future spending or returns
5. **No Anomaly Detection**: Doesn't flag unusual transactions (e.g., spike in spending)

---

## Summary

Tara combines a normalized Postgres schema, specialized financial tools, and a grounded LLM agent to provide reliable, data-backed answers to personal finance questions. The design prioritizes correctness and generalization to unseen data over clever inference or optimization.
