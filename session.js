module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: "OPENAI_API_KEY not set." });

  const contentType = req.headers["content-type"] || "";

  // If the body is SDP (WebRTC offer from browser), forward to OpenAI /calls
  if (contentType.includes("application/sdp") || contentType.includes("text/plain")) {
    const sdp = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    try {
      const r = await fetch("https://api.openai.com/v1/realtime/calls?model=gpt-4o-realtime-preview-2024-12-17", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + key,
          "Content-Type": "application/sdp",
        },
        body: sdp,
      });

      const sdpAnswer = await r.text();
      if (!r.ok) {
        console.error("WebRTC calls error:", r.status, sdpAnswer);
        return res.status(r.status).send(sdpAnswer);
      }
      res.setHeader("Content-Type", "application/sdp");
      return res.status(200).send(sdpAnswer);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Otherwise it's a JSON request for session config — return model/voice info
  const raw = await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch(e) {}

  // Return the config the client needs (no ephemeral key needed with server-proxied approach)
  return res.status(200).json({
    model: "gpt-4o-realtime-preview-2024-12-17",
    voice: body.voice || "alloy",
    ok: true,
  });
};
