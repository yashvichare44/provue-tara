# AGENTS.md — Tara Finance-Research Agent

## Tara Agent Overview

**Tara** is a personal finance-research agent that answers natural language questions about spending, investments, and portfolio performance using real database queries.

### Key Capabilities

- **Spending Analysis**: Query transactions by date, category, merchant
- **Category Comparison**: Compare spending patterns across categories and time periods  
- **Recurring Detection**: Identify merchants with recurring/subscription-like spending
- **Fund Analysis**: Calculate fund period returns and portfolio performance
- **Holdings Analysis**: Calculate user's realised returns on mutual fund holdings

### System Prompt

Tara is configured to:
1. Ground all answers in database queries (no guesses)
2. Handle multi-step questions by chaining tools
3. Be precise about numbers and dates
4. Acknowledge data limitations

### Registered in

See `src/mastra/index.ts` — Tara is registered as the sole agent in the Mastra instance.

---

## Available Tools

Tara has access to 7 specialized financial query tools:

| Tool | Purpose |
|------|---------|
| `query_transactions` | Flexible transaction filtering with aggregation |
| `compare_spending` | Multi-category spending comparisons |
| `get_merchant_spending` | Detailed merchant analysis |
| `find_recurring` | Identify recurring subscription patterns |
| `fund_period_return` | Calculate fund NAV-based period returns |
| `holding_realised_return` | Calculate user's return on holdings |
| `get_monthly_spending` | Trend analysis by month |

See `src/mastra/tools/finance-tools.ts` for tool definitions and input/output schemas.

---

## Data & Schema

**Database**: Postgres (connection via `src/db/connection.ts`)

**Tables**:
- `transactions` (15 months of spending, ~1500 rows)
- `funds` (8 mutual funds with market data)
- `fund_nav` (24 months of NAV history)
- `holdings` (user's current portfolio)
- `merchant_aliases` (inferred aliases for merchant normalization)

See `src/db/schema.ts` and `DESIGN.md` for schema details.

---

## Ingestion & Testing

### Load Data

```bash
# Load sample_a
DATA_DIR=./data/sample_a npm run ingest

# Load sample_b
DATA_DIR=./data/sample_b npm run ingest

# Load sample_c (different merchants, NEFT-style memos)
DATA_DIR=./data/sample_c npm run ingest
```

### Test the Agent

```bash
# Start server
npm run server

# In another terminal, test /ask
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How much did I spend on food?"}'

# Run evaluation suite (14 test cases)
npm run eval
```

---

## Configuration

Set these environment variables:

- `DATABASE_URL`: Postgres connection (default: `postgres://postgres:postgres@localhost:5432/provue_tara`)
- `LLM_PROVIDER`: Model provider (default: `openai`)
- `LLM_MODEL`: Model name (default: `gpt-4o-mini`)
- `OPENAI_API_KEY`: Your API key (required)
- `PORT`: HTTP server port (default: `3000`)

---

## CRITICAL: Mastra Setup

Load the `mastra` skill BEFORE any Mastra work. Never rely on cached knowledge — APIs change between versions.

### Rules

- Register all agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Use the `dev` and `build` scripts from `package.json` instead of running `mastra dev` / `mastra build` directly

### Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
- [Skills Discovery](https://mastra.ai/.well-known/skills/index.json)
- [Agent Reference](https://mastra.ai/reference/agents/agent)
- [Tools Reference](https://mastra.ai/reference/tools/create-tool)

