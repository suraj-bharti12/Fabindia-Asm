export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const store_code = body.store_code;

  if (!store_code) {
    return res.status(400).json({ success: false, error: "store_code required" });
  }

  const user = process.env.EMPLOYEE_API_USER;
  const pass = process.env.EMPLOYEE_API_PASS;

  if (!user || !pass) {
    return res.status(500).json({ success: false, error: "Server misconfigured" });
  }

  const auth = Buffer.from(`${user}:${pass}`).toString("base64");

  try {
    const upstream = await fetch(
      "https://mojito.mojitolabs.com/fabindia/employee_list.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({ store_code }),
      }
    );

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ success: false, error: "Upstream failed" });
  }
}