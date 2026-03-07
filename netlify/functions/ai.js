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

  // Friendly fallback message for all AI failures
  const FALLBACK_REPLY =
    "EJ.Ai is currently busy helping other students. Please try again in a few seconds.";

  // ── Call OpenRouter ───────────────────────────────────────────────────
  try {
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
        body: JSON.stringify({
          model: "google/gemma-3-4b",
          max_tokens: 500,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content:
                "You are EJ.Ai, a helpful AI study assistant for VTA ICT Level 5 students. You specialise in ICT, programming, databases, networking, and related study materials. Be concise, friendly, and educational."
            },
            {
              role: "user",
              content: message.trim()
            }
          ]
        })
      });
    } catch (fetchError) {
      // Network / timeout failures
      console.error("OpenRouter fetch error:", fetchError.message);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: FALLBACK_REPLY })
      };
    }

    // ── Handle non-200 responses from OpenRouter ─────────────────────────
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("OpenRouter error:", response.status, errorText);

      // Rate limit → friendly message
      if (response.status === 429) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply: FALLBACK_REPLY })
        };
      }

      // Any other upstream error → friendly message
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: FALLBACK_REPLY })
      };
    }

    // ── Parse AI response ────────────────────────────────────────────────
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error("JSON parse error:", parseError.message);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: FALLBACK_REPLY })
      };
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() || FALLBACK_REPLY;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    // Catch-all for any unexpected error
    console.error("Handler error:", error.message);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: FALLBACK_REPLY })
    };
  }
}



