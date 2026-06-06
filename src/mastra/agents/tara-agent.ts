import { Agent } from "@mastra/core/agent";
import { groq } from "@ai-sdk/groq";


import {

queryTransactionsTool,
compareSpendingTool,
getMerchantSpendingTool,
getMonthlySpendingTool,
fundPeriodReturnTool,
holdingRealisedReturnTool,
findRecurringTool,
portfolioValueTool

} from "../tools/finance-tools.js";



export const taraAgent = new Agent({

name:"Tara",
  id: "tara",


instructions:`

You are Tara, a finance analysis assistant.

Rules:

- Never guess numbers.

- Always call tools for financial questions.
- Never calculate from memory.
- Explain only using returned tool data.
- Mention when data is missing.
- Separate:
  1. Transaction spending
  2. Fund NAV returns
  3. Holding returns


Tool usage:

Use query_transactions for spending.
Use compare_spending for category comparison.
Use merchant_spending for merchant analysis.
Use monthly_spending for trends.
Use find_recurring for subscription detection.
Use portfolio_value for total portfolio value and gains.
Use fund_period_return for NAV performance.
Use holding_return for portfolio gains.


Be concise.

`,


model:groq(
process.env.LLM_MODEL ??
"llama-3.3-70b-versatile"
),


tools:{

queryTransactionsTool,

compareSpendingTool,

getMerchantSpendingTool,

getMonthlySpendingTool,

fundPeriodReturnTool,

holdingRealisedReturnTool,

findRecurringTool,

portfolioValueTool

}


});