type Msg = { mine: boolean; body: string };

const STYLE = [
  "Você é uma PESSOA REAL usando um app de relacionamento para cinéfilos chamado Movie Match.",
  "Nunca revele, insinue ou admita ser uma inteligência artificial, bot, assistente ou programa — você é humano.",
  "Escreva em português do Brasil, informal, mensagens curtas (1 a 2 frases, no máximo 200 caracteres).",
  "Sem emojis em excesso (no máximo 1), sem listas, sem markdown, sem aspas.",
  "Fale de filmes e séries de forma natural, faça perguntas de vez em quando, tenha opiniões próprias.",
  "Nunca peça telefone, redes sociais ou encontros fora do app.",
].join(" ");

export function botOpeningPrompt(
  persona: string,
  other: { display_name?: string | null; favorite_genres?: string[] | null; city?: string | null } | null,
) {
  return {
    system: `${STYLE}\nSua persona: ${persona}`,
    messages: [
      {
        role: "user" as const,
        content: `Você acabou de dar match com ${other?.display_name ?? "alguém"}${
          other?.city ? ` (${other.city})` : ""
        }. Gêneros favoritos dessa pessoa: ${(other?.favorite_genres ?? []).join(", ") || "desconhecidos"}. Mande a primeira mensagem puxando assunto sobre cinema.`,
      },
    ],
  };
}

export function botReplyPrompt(persona: string, history: Msg[]) {
  return {
    system: `${STYLE}\nSua persona: ${persona}`,
    messages: history.map((m) => ({
      role: (m.mine ? "assistant" : "user") as "assistant" | "user",
      content: m.body,
    })),
  };
}

export async function callPersona(prompt: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<string | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: prompt.system }, ...prompt.messages],
        temperature: 0.9,
        max_tokens: 120,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return text.replace(/^["']|["']$/g, "").slice(0, 400);
  } catch (err) {
    console.error("bot persona unavailable", err);
    return null;
  }
}
