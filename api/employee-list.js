// Employee list proxy.
// Picks the upstream API per Shopify store:
//   - stores listed in TEST_SHOPS  -> EMPLOYEE_API_URL_TEST (testing server)
//   - every other store            -> EMPLOYEE_API_URL      (live server)
// The checkout extension sends `shop` (its myshopify domain) in the body.
// Requests without `shop` (older extension versions) go to live.

const DEFAULT_LIVE_URL = "https://mojito.mojitolabs.com/fabindia/employee_list.php";

function testShops() {
  return (process.env.TEST_SHOPS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function pickUpstream(shop) {
  const isTest = Boolean(shop) && testShops().includes(shop);

  if (isTest) {
    return {
      env: "test",
      url: process.env.EMPLOYEE_API_URL_TEST,
      // Test server may use its own credentials; falls back to live ones.
      user: process.env.EMPLOYEE_API_USER_TEST || process.env.EMPLOYEE_API_USER,
      pass: process.env.EMPLOYEE_API_PASS_TEST || process.env.EMPLOYEE_API_PASS,
    };
  }

  return {
    env: "live",
    url: process.env.EMPLOYEE_API_URL || DEFAULT_LIVE_URL,
    user: process.env.EMPLOYEE_API_USER,
    pass: process.env.EMPLOYEE_API_PASS,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "X-Api-Env");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return res.status(400).json({ success: false, error: "Invalid JSON" });
  }

  const store_code = body.store_code;
  const shop = String(body.shop || "").trim().toLowerCase();

  if (!store_code) {
    return res.status(400).json({ success: false, error: "store_code required" });
  }

  const upstreamCfg = pickUpstream(shop);
  res.setHeader("X-Api-Env", upstreamCfg.env);

  if (!upstreamCfg.url || !upstreamCfg.user || !upstreamCfg.pass) {
    return res.status(500).json({ success: false, error: "Server misconfigured" });
  }

  const auth = Buffer.from(`${upstreamCfg.user}:${upstreamCfg.pass}`).toString("base64");

  try {
    const upstream = await fetch(upstreamCfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ store_code }),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    console.error(`[employee-list] ${upstreamCfg.env} upstream failed:`, e?.message);
    return res.status(502).json({ success: false, error: "Upstream failed" });
  }
}