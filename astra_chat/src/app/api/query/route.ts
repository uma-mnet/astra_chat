import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const schemaInfo = `
You are querying data from a ClickHouse database with two main tables. Return only the SQL query, no explanations. Use the cm database.
So the table name should be cm.astra_logging and cm.ad_click_et.

---

**Table: astra_logging**
- Description: Contains detailed logs from the ad auction and bidding system. No revenue data.
- Common Fields:
  - uid (String): Unique user identifier
  - timestamp, ts (String): Timestamp of the event
  - geo_city (String): City of the user
  - device_type (String): Type of device
  - target_ecpm, response_bid (String): eCPM and bid details
  - site_domain, site_page, placementcode (String): Publisher site info
  - campaign-related fields: adv_domain_name_ac, keyword_term_ac, opp_id_ac etc.
  - bid_price_logits, top_n_keywords (Array): Model inputs and outputs

---

**Table: ad_click_et**
- Description: Contains ad click data including revenue.
- Common Fields:
  - click_id (String): Unique click identifier
  - ts, time_stamp (String): Timestamp of the click
  - adv_domain_name (String): Advertiser domain
  - opp_id (String): Opportunity ID (can be joined with astra_logging)
  - net_total_revenue (Float64): Revenue from the click
  - keyword_term, keyword_position_id: Keyword info

---

**Important Notes:**
- opp_id can be used to join between astra_logging and ad_click_et.
- You can perform aggregate queries like total revenue, eCPM by geo_city, device_type, etc.
- Prefer filtering on ts or new_date for performance.
- Return simple and valid ClickHouse SQL statements only.
`;


async function getSQLFromPrompt(message: string) {
  const prompt = `
You are a ClickHouse SQL assistant. Return only the SQL query, no explanations.

${schemaInfo}

Convert this to a SQL query:
"${message}"
`;

  const chat = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const sqlRaw = chat.choices[0].message.content?.trim() || "SELECT 1";
  // Remove markdown code block if present
  const sql = sqlRaw.replace(/```sql|```/gi, "").trim();
  return sql || "SELECT 1";
}

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  // Collect debug info
  const debug: any = { receivedMessage: message };

  const prompt = `
You are a ClickHouse SQL assistant. Return only the SQL query, no explanations.

${schemaInfo}

Convert this to a SQL query:
"${message}"
`;
  debug.prompt = prompt;

  const chat = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const sqlRaw = chat.choices[0].message.content?.trim() || "SELECT 1";
  // Remove markdown code block if present
  const sql = sqlRaw.replace(/```sql|```/gi, "").trim();
  debug.sql = sql;

//   if (!/^select/i.test((sql || "").trim())) {
//     debug.rejection = "Only SELECT queries are allowed.";
//     return NextResponse.json({ result: "Only SELECT queries are allowed.", debug }, { status: 400 });
//   }

  const clickhouseUrl = process.env.CLICKHOUSE_HOST!;
  const headers = {
    "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID!,
    "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET!,
  };

  try {
    const res = await fetch(clickhouseUrl, {
      method: "POST",
      headers,
      body: sql,
    });

    const text = await res.text();
    debug.clickhouseResponse = text;
    return NextResponse.json({ result: `Query:\n${sql}\n\n${text}`, debug });
  } catch (e) {
    debug.error = String(e);
    return NextResponse.json({ result: "Query failed.", debug }, { status: 500 });
  }
}
