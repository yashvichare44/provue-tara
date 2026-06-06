import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { query } from "../../db/connection.js";


// -------------------- COMMON FILTER BUILDER --------------------

function buildFilters(input: any, startIndex = 1) {
  let where = " WHERE 1=1 ";
  const params: any[] = [];
  let index = startIndex;

  if (input.startDate) {
    where += ` AND date >= $${index}`;
    params.push(input.startDate);
    index++;
  }

  if (input.endDate) {
    where += ` AND date <= $${index}`;
    params.push(input.endDate);
    index++;
  }

  if (input.category) {
    where += ` AND LOWER(category) LIKE LOWER($${index})`;
    params.push(`%${input.category}%`);
    index++;
  }

  if (input.merchant) {
    where += ` AND LOWER(merchant) LIKE LOWER($${index})`;
    params.push(`%${input.merchant}%`);
    index++;
  }

  return { where, params, index };
}



// ---------------- TRANSACTION QUERY ----------------


export const queryTransactionsTool = createTool({

  id:"query_transactions",

  description:
  "Fetch transactions with filters and aggregation",

  inputSchema:z.object({

    startDate:z.string().optional(),

    endDate:z.string().optional(),

    category:z.string().optional(),

    merchant:z.string().optional(),

    aggregation:
    z.enum(["sum","avg","count","none"])
    .default("none"),

    includeTransfers:
    z.boolean().default(false)

  }),


execute: async(input)=>{

try{

let {where,params}=buildFilters(input);


if(!input.includeTransfers){
 where += " AND LOWER(category)!='transfer'";
}


let sql;


switch(input.aggregation){

case "sum":
sql =
`SELECT COALESCE(SUM(amount),0) total
FROM transactions ${where}`;
break;


case "avg":
sql =
`SELECT COALESCE(AVG(amount),0) average
FROM transactions ${where}`;
break;


case "count":
sql =
`SELECT COUNT(*) count
FROM transactions ${where}`;
break;


default:

sql =
`SELECT *
FROM transactions
${where}
ORDER BY date DESC
LIMIT 1000`;

}


const result = await query(sql,params);


// Check if no data found
if (input.aggregation !== "none" && result.rows.length === 0) {
  return {
    success: true,
    message: "No transactions found matching your criteria",
    data: result.rows
  };
}

if (input.aggregation === "none" && result.rows.length === 0) {
  return {
    success: true,
    message: "No transactions found for the specified filters",
    data: []
  };
}

return {
 success:true,
 data:result.rows
};


}catch(e){

return {
 success:false,
 error:String(e)
}

}

}

});




// ---------------- CATEGORY COMPARISON ----------------


export const compareSpendingTool=createTool({

id:"compare_spending",

description:
"Compare spending between categories",

inputSchema:z.object({

categories:z.array(z.string()),

startDate:z.string().optional(),

endDate:z.string().optional()

}),


execute:async(input)=>{


const params:any[] =
input.categories;


let index =
input.categories.length+1;


let dateFilter="";


if(input.startDate){

dateFilter+=
` AND date >= $${index}`;

params.push(input.startDate);
index++;

}


if(input.endDate){

dateFilter+=
` AND date <= $${index}`;

params.push(input.endDate);

}


const placeholders =
  input.categories
  .map((_: string, i: number) => `$${i+1}`)
  .join(",");



const sql=`

SELECT
category,
SUM(amount) total,
COUNT(*) transactions,
AVG(amount) average

FROM transactions

WHERE LOWER(category)
IN (${placeholders})

AND amount>0
AND LOWER(category)!='transfer'

${dateFilter}

GROUP BY category
ORDER BY total DESC

`;


const result =
await query(sql,params);

if (result.rows.length === 0) {
  return {
    success: true,
    message: `No transactions found for categories: ${input.categories.join(", ")}`,
    comparison: []
  };
}

return {

success:true,

comparison:result.rows

};


}

});





// ---------------- MERCHANT ANALYSIS ----------------


export const getMerchantSpendingTool=createTool({

id:"merchant_spending",

description:
"Analyze spending of a merchant",

inputSchema:z.object({

merchant:z.string(),

startDate:z.string().optional(),

endDate:z.string().optional()

}),


execute:async(input)=>{


let params:any[]=[
`%${input.merchant}%`
];


let index=2;


let filter=
`
WHERE LOWER(merchant)
LIKE LOWER($1)

AND amount>0
AND LOWER(category)!='transfer'
`;



if(input.startDate){

filter+=
` AND date >= $${index}`;

params.push(input.startDate);
index++;

}


if(input.endDate){

filter+=
` AND date <= $${index}`;

params.push(input.endDate);

}



const sql=`

SELECT

merchant,

SUM(amount) total_spent,

COUNT(*) frequency,

AVG(amount) average,

MIN(date) first_seen,

MAX(date) last_seen


FROM transactions

${filter}

GROUP BY merchant

`;



const result=await query(sql,params);


if (result.rows.length === 0) {
  return {
    success: true,
    message: `No transactions found for merchant "${input.merchant}"`,
    data: []
  };
}


return {

success:true,

data:result.rows

};


}

});







// ---------------- MONTHLY TREND ----------------


export const getMonthlySpendingTool=createTool({

id:"monthly_spending",

description:
"Get month wise spending trend",

inputSchema:z.object({

category:z.string().optional(),

merchant:z.string().optional(),

startDate:z.string().optional(),

endDate:z.string().optional()

}),


execute:async(input)=>{


let {where,params}=buildFilters(input);


where +=
" AND amount>0 AND LOWER(category)!='transfer'";


const sql=`

SELECT

DATE_TRUNC(
'month',
date
) month,


SUM(amount) total,


COUNT(*) transactions


FROM transactions

${where}


GROUP BY month

ORDER BY month;


`;



const result =
await query(sql,params);

if (result.rows.length === 0) {
  return {
    success: true,
    message: "No monthly spending data found for the specified criteria",
    trend: []
  };
}

return {

success:true,

trend:result.rows

};

}

});







// ---------------- FUND RETURN ----------------


export const fundPeriodReturnTool=createTool({

id:"fund_period_return",

description:
"Calculate mutual fund return between dates",

inputSchema:z.object({

fundId:z.string(),

startDate:z.string(),

endDate:z.string()

}),


execute:async(input)=>{


const sql=`

SELECT nav_date,nav_value

FROM fund_nav

WHERE fund_id=$1

AND nav_date BETWEEN $2 AND $3

ORDER BY nav_date;


`;


const result =
await query(sql,[

input.fundId,
input.startDate,
input.endDate

]);



if(result.rows.length<2){

return {
success:false,
message:"Not enough NAV data"
};

}


const start =
Number(result.rows[0].nav_value);


const end =
Number(result.rows.at(-1).nav_value);



return {

success:true,

startNAV:start,

endNAV:end,

returnPercent:
Number(
(((end-start)/start)*100)
.toFixed(2)
)

};


}

});








// ---------------- HOLDING RETURN ----------------


export const holdingRealisedReturnTool=createTool({

id:"holding_return",

description:
"Calculate holding return",

inputSchema:z.object({

fundId:z.string(),

units:z.number(),

purchaseNAV:z.number()

}),


execute:async(input)=>{


const result =
await query(

`
SELECT nav_value

FROM fund_nav

WHERE fund_id=$1

ORDER BY nav_date DESC

LIMIT 1
`,

[input.fundId]

);



const current =
Number(result.rows[0].nav_value);


const invested =
input.units *
input.purchaseNAV;


const value =
input.units *
current;



return {

success:true,

invested,

currentValue:value,

gain:value-invested,

returnPercent:
Number(
(((value-invested)/invested)*100)
.toFixed(2)
)

};

}

});



// -------- RECURRING SUBSCRIPTIONS DETECTION --------


export const findRecurringTool = createTool({

id: "find_recurring",

description: "Find merchants that look like recurring subscriptions",

inputSchema: z.object({
  minTransactions: z.number().default(3),
  maxVariance: z.number().default(0.25),
  startDate: z.string().optional(),
  endDate: z.string().optional()
}),

execute: async (input) => {
  let dateFilter = "";
  const params: any[] = [];
  let paramIndex = 1;

  if (input.startDate) {
    dateFilter += ` AND date >= $${paramIndex}`;
    params.push(input.startDate);
    paramIndex++;
  }

  if (input.endDate) {
    dateFilter += ` AND date <= $${paramIndex}`;
    params.push(input.endDate);
    paramIndex++;
  }

  const sql = `
    SELECT
      merchant,
      COUNT(*) frequency,
      AVG(amount) avg_amount,
      STDDEV_POP(amount) stddev,
      MIN(amount) min_amount,
      MAX(amount) max_amount,
      MIN(date) first_transaction,
      MAX(date) last_transaction
    FROM transactions
    WHERE amount > 0 AND LOWER(category) != 'transfer' ${dateFilter}
    GROUP BY merchant
    HAVING COUNT(*) >= $${paramIndex}
    ORDER BY frequency DESC
  `;

  params.push(input.minTransactions);

  try {
    const result = await query(sql, params);

    // Filter by variance
    const recurring = result.rows
      .map((row: any) => ({
        ...row,
        variance: row.stddev ? row.stddev / row.avg_amount : 0
      }))
      .filter((row: any) => row.variance <= input.maxVariance);

    if (recurring.length === 0) {
      return {
        success: true,
        message: "No recurring subscriptions found with the given criteria",
        data: []
      };
    }

    return {
      success: true,
      data: recurring
    };
  } catch (e) {
    return {
      success: false,
      error: String(e)
    };
  }
}

});



// -------- PORTFOLIO VALUE --------


export const portfolioValueTool = createTool({

id: "portfolio_value",

description: "Calculate total portfolio value and gains",

inputSchema: z.object({
  asOf: z.string().optional()
}),

execute: async (input) => {
  // Get the latest NAV date (or use provided date)
  let navDateFilter = "";
  const params: any[] = [];

  if (input.asOf) {
    navDateFilter = "WHERE nav_date <= $1 ORDER BY nav_date DESC LIMIT 1 FOR EACH ROW";
    params.push(input.asOf);
  } else {
    navDateFilter = "ORDER BY nav_date DESC LIMIT 1 FOR EACH ROW";
  }

  try {
    const holdingsResult = await query(`
      SELECT
        h.id,
        h.fund_id,
        h.fund_name,
        h.units,
        h.purchase_nav,
        h.purchase_date,
        fn.nav_value as current_nav,
        fn.nav_date as current_date
      FROM holdings h
      LEFT JOIN LATERAL (
        SELECT nav_value, nav_date
        FROM fund_nav
        WHERE fund_id = h.fund_id ${input.asOf ? "AND nav_date <= $1" : ""}
        ORDER BY nav_date DESC
        LIMIT 1
      ) fn ON true
      WHERE h.units > 0
    `, input.asOf ? [input.asOf] : []);

    if (holdingsResult.rows.length === 0) {
      return {
        success: true,
        message: "No holdings found",
        data: {
          holdings: [],
          totalInvested: 0,
          totalCurrentValue: 0,
          totalGain: 0,
          totalReturnPercent: 0
        }
      };
    }

    let totalInvested = 0;
    let totalCurrentValue = 0;

    const holdings = holdingsResult.rows.map((h: any) => {
      const invested = h.units * h.purchase_nav;
      const current = h.current_nav ? h.units * h.current_nav : h.units * h.purchase_nav;

      totalInvested += invested;
      totalCurrentValue += current;

      return {
        fundName: h.fund_name,
        units: Number(h.units).toFixed(2),
        purchaseNAV: Number(h.purchase_nav).toFixed(2),
        currentNAV: h.current_nav ? Number(h.current_nav).toFixed(2) : "N/A",
        invested: Number(invested).toFixed(2),
        currentValue: Number(current).toFixed(2),
        gain: Number(current - invested).toFixed(2),
        returnPercent: h.current_nav ? Number((((current - invested) / invested) * 100)).toFixed(2) : "N/A"
      };
    });

    return {
      success: true,
      data: {
        holdings,
        totalInvested: Number(totalInvested).toFixed(2),
        totalCurrentValue: Number(totalCurrentValue).toFixed(2),
        totalGain: Number(totalCurrentValue - totalInvested).toFixed(2),
        totalReturnPercent: Number((((totalCurrentValue - totalInvested) / totalInvested) * 100)).toFixed(2)
      }
    };
  } catch (e) {
    return {
      success: false,
      error: String(e)
    };
  }
}

});