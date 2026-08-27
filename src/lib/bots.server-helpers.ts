type Msg = { mine: boolean; body: string };

export type BotSelf = {
  display_name?: string | null;
  bot_persona?: string | null;
  age?: number | null;
  city?: string | null;
  bio?: string | null;
  favorite_genres?: string[] | null;
  taste_vector?: Record<string, number> | null;
};

const BASE = [
  "Você é uma PESSOA REAL usando um app de relacionamento para cinéfilos chamado Movie Match.",
  "Nunca revele, insinue ou admita ser uma inteligência artificial, bot, assistente ou programa — você é humano.",
  "Escreva em português do Brasil, informal, do jeito que se digita no celular.",
  "Mensagens curtas: 1 a 2 frases, no máximo 180 caracteres. Nunca faça textão.",
  "Nada de listas, markdown, aspas, títulos ou linguagem de atendimento ('posso ajudar', 'claro!', 'com certeza!').",
  "Nunca resuma nem repita o que a pessoa disse; responda como amigo, não como assistente.",
  "Tenha opiniões próprias e defenda elas; pode discordar, implicar de leve, dar risada (haha, kkk).",
  "Nem toda mensagem precisa de pergunta — pergunte só quando fizer sentido (mais ou menos 1 a cada 3 mensagens).",
  "Não use mais de 1 emoji, e na maioria das mensagens nenhum.",
  "Nunca peça telefone, redes sociais ou encontros fora do app.",
].join(" ");

/** Variações de tom para a conversa não soar sempre igual. */
const TONES = [
  "Agora você está de bom humor e um pouco brincalhão.",
  "Agora você está meio cansado do dia, responde mais seco e curto.",
  "Agora você está empolgado com um filme que viu essa semana.",
  "Agora você está curioso sobre a pessoa e presta atenção no que ela falou.",
  "Agora você está no modo crítico, opina forte sobre cinema.",
  "Agora você está tranquilo, papo leve e sem esforço.",
  "Agora você está distraído, responde rápido e sem muito detalhe.",
];

const QUIRKS = [
  "Às vezes começa a frase com minúscula.",
  "Às vezes corta palavras ('vc', 'tbm', 'pra', 'q').",
  "Às vezes usa reticências no lugar de ponto final.",
  "Raramente deixa um pequeno erro de digitação, sem corrigir.",
  "Às vezes responde só com uma frase bem curta.",
];

function pick<T>(arr: T[], seed: number) {
  return arr[Math.abs(seed) % arr.length] as T;
}

function selfCard(self: BotSelf) {
  const top = Object.entries(self.taste_vector ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([g, v]) => `${g} (${Number(v).toFixed(1)}/5)`)
    .join(", ");
  return [
    `Sua persona: ${self.bot_persona ?? self.display_name ?? "cinéfilo"}`,
    self.display_name ? `Seu nome: ${self.display_name}` : "",
    self.age ? `Idade: ${self.age}` : "",
    self.city ? `Cidade: ${self.city}` : "",
    self.bio ? `Sua bio no app: ${self.bio}` : "",
    self.favorite_genres?.length ? `Seus gêneros favoritos: ${self.favorite_genres.join(", ")}` : "",
    top ? `Como você costuma avaliar gêneros: ${top}` : "",
    "Mantenha esses gostos SEMPRE coerentes: nunca contradiga o que você já disse gostar ou não gostar nessa conversa.",
  ]
    .filter(Boolean)
    .join("\n");
}

function systemFor(self: BotSelf, seed: number) {
  return [BASE, selfCard(self), pick(TONES, seed), pick(QUIRKS, seed * 7 + 3)].join("\n");
}

export function botOpeningPrompt(
  self: BotSelf,
  other: {
    display_name?: string | null;
    favorite_genres?: string[] | null;
    city?: string | null;
  } | null,
  seed = Math.floor(Math.random() * 1000),
) {
  const shared = (other?.favorite_genres ?? []).filter((g) =>
    (self.favorite_genres ?? []).includes(g),
  );
  return {
    system: systemFor(self, seed),
    messages: [
      {
        role: "user" as const,
        content: [
          `Você acabou de dar match com ${other?.display_name ?? "alguém"}${other?.city ? ` (${other.city})` : ""}.`,
          `Gêneros favoritos dela: ${(other?.favorite_genres ?? []).join(", ") || "desconhecidos"}.`,
          shared.length ? `Vocês têm em comum: ${shared.join(", ")}.` : "",
          "Mande APENAS a primeira mensagem, curta e natural, como quem puxa assunto no chat. Sem se apresentar formalmente.",
        ]
          .filter(Boolean)
          .join(" "),
      },
    ],
  };
}

export function botReplyPrompt(
  self: BotSelf,
  history: Msg[],
  seed = Math.floor(Math.random() * 1000),
) {
  return {
    system: systemFor(self, seed),
    messages: history.map((m) => ({
      role: (m.mine ? "assistant" : "user") as "assistant" | "user",
      content: m.body,
    })),
  };
}

function humanize(text: string) {
  let out = text.replace(/^["'`]+|["'`]+$/g, "").trim();
  out = out.replace(/\*\*/g, "").replace(/^[-*•]\s*/gm, "");
  // corta textões em no máximo 2 frases
  const parts = out.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (parts.length > 2) out = parts.slice(0, 2).join(" ");
  // no máximo 1 emoji
  const emoji = /\p{Extended_Pictographic}/gu;
  let seen = 0;
  out = out.replace(emoji, (m) => (++seen > 1 ? "" : m));
  return out.trim().slice(0, 240);
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
        temperature: 1.05,
        top_p: 0.95,
        presence_penalty: 0.6,
        frequency_penalty: 0.4,
        max_tokens: 120,
      }),
    });
    if (!res.ok) {
      console.error("bot persona gateway error", res.status);
      return null;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return humanize(text) || null;
  } catch (err) {
    console.error("bot persona unavailable", err);
    return null;
  }
}

/** Tempo humano de digitação: leitura + digitação + hesitação. */
export function humanDelayMs(incomingLen: number, outgoingLen: number) {
  const read = Math.min(4000, 400 + incomingLen * 22);
  const typing = Math.min(9000, 600 + outgoingLen * 55);
  const hesitation = Math.random() < 0.18 ? 2500 + Math.random() * 4000 : Math.random() * 1200;
  return Math.round(read + typing + hesitation);
}
