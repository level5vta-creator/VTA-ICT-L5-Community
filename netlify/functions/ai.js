export async function handler(event) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  // ── Request body validation ───────────────────────────────────────────
  let message;
  try {
    const body = JSON.parse(event.body || "{}");
    message = body.message;
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid request body." })
    };
  }

  if (!message || typeof message !== "string" || message.trim() === "") {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Message is required and must be a non-empty string." })
    };
  }

  // Friendly fallback message shown only when ALL models fail
  const FALLBACK_REPLY =
    "EJ.Ai is currently busy helping other students. Please try again in a few seconds.";

  // ── Model priority list ───────────────────────────────────────────────
  // Try primary first; on any failure wait 1 s then try fallback.
  const MODELS = [
    "openrouter/free",
    "google/gemini-2.5-flash-lite"
  ];

  // ── Shared request payload builder ───────────────────────────────────
  function buildPayload(model) {
    return JSON.stringify({
      model,
      max_tokens: 500,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are EJ.Ai, a helpful AI study assistant for ICT students."
        },
        {
          role: "user",
          content: message.trim()
        }
      ]
    });
  }

  // ── Single model attempt ──────────────────────────────────────────────
  async function tryModel(model) {
    let response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://vta-ict-l5-community.netlify.app",
          "X-Title": "VTA ICT L5 Community AI"
        },
        body: buildPayload(model)
      });
    } catch (fetchError) {
      // Network / DNS / timeout error
      console.error(`[${model}] fetch error:`, fetchError.message);
      return null;
    }

    // Non-2xx from OpenRouter (rate limit, overload, etc.)
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[${model}] HTTP ${response.status}:`, errorText);
      return null;
    }

    // Parse the response body
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error(`[${model}] JSON parse error:`, parseError.message);
      return null;
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      console.error(`[${model}] Empty reply from model`);
      return null;
    }

    return reply;
  }

  // ── Fallback loop ─────────────────────────────────────────────────────
  try {
    for (let i = 0; i < MODELS.length; i++) {
      const model = MODELS[i];

      // Wait 1 second before every retry (not before the first attempt)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`Attempting model: ${model}`);
      const reply = await tryModel(model);

      if (reply !== null) {
        // Success — return immediately
        console.log(`Success with model: ${model}`);
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply })
        };
      }

      console.warn(`Model failed, moving to next: ${model}`);
    }

    // All models exhausted
    console.error("All models failed. Returning fallback reply.");
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: FALLBACK_REPLY })
    };
  } catch (error) {
    // Catch-all for any unexpected handler error
    console.error("Handler error:", error.message);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: FALLBACK_REPLY })
    };
  }
}



