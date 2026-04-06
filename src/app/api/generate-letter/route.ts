import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT =
  "You are helping a home buyer write a warm, genuine, personal letter to homeowners in their dream neighborhood. The letter should feel human and heartfelt, not like a real estate solicitation. It should be 3-4 paragraphs, conversational, mention specific personal details the buyer provided, and end with a genuine offer to help the neighborhood. Never use salesy language.";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, city, whyNeighborhood, family, neighborType, memorableDetails } = body;

  const userPrompt = `Write a heartfelt letter from a home buyer to homeowners in their dream neighborhood. Here are the details about the buyer:

Name: ${name}
Current city: ${city}
Why they want to live in this neighborhood: ${whyNeighborhood}
About their family: ${family}
What kind of neighbor they will be: ${neighborType}
${memorableDetails ? `Personal details that make them memorable: ${memorableDetails}` : ""}

Write the letter starting with the date "${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}", then "Dear Neighbor," and ending with a warm sign-off and the buyer's name. Do not include any bracketed placeholders.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    console.log("ANTHROPIC_API_KEY present:", !!process.env.ANTHROPIC_API_KEY);

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return Response.json({ error: "No text in response" }, { status: 500 });
    }

    return Response.json({ letter: text.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number }).status;
    console.error("Claude API error:", { message, status, err });
    return Response.json({ error: "Failed to generate letter", detail: message }, { status: 500 });
  }
}
