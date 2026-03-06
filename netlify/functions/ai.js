export async function handler(event) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const { message } = JSON.parse(event.body);

    if (!message || typeof message !== "string" || message.trim() === "") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message is required." })
      };
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://vta-ict-l5-community.netlify.app",
          "X-Title": "VTA ICT L5 Community AI"
        },
        body: JSON.stringify({
          model: "z-ai/glm-4.5-air:free",
          messages: [
            {
              role: "system",
              content: "You are EJ.Ai, a helpful AI study assistant for VTA ICT Level 5 students. You specialise in ICT, programming, databases, networking, and related study materials. Be concise, friendly, and educational."
            },
            {
              role: "user",
              content: message
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("OpenRouter error:", response.status, errorBody);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Upstream AI service error." })
      };
    }

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content || "No response from AI.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AI request failed." })
    };
  }
}
