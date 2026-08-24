/**
 * Client-side chat moderation: blocks contact sharing and offensive language.
 * Server-side re-validation lives in src/lib/moderation.functions.ts.
 */

const SOCIAL_PATTERNS: RegExp[] = [
  /\binsta(gram)?\b/i,
  /\bwh?ats?\s?app\b/i,
  /\bzap\b/i,
  /\btelegram\b/i,
  /\bface(book)?\b/i,
  /\bsnap(chat)?\b/i,
  /\btiktok\b/i,
  /\bt\.me\//i,
  /\bwa\.me\//i,
  /@[a-z0-9._]{3,}/i,
];

const EMAIL = /[a-z0-9._%+-]+\s?(@|\(at\)|\[at\])\s?[a-z0-9.-]+\.[a-z]{2,}/i;
// 8+ digits with optional separators — catches phone numbers written creatively.
const PHONE = /(?:\d[\s().-]?){8,}/;

const OFFENSIVE = [
  "idiota",
  "imbecil",
  "otario",
  "otário",
  "vagabunda",
  "vagabundo",
  "puta",
  "viado",
  "bicha",
  "retardado",
  "macaco",
  "arrombado",
  "fdp",
  "corno",
  "buceta",
  "caralho",
  "porra",
  "piranha",
  "bitch",
  "whore",
  "faggot",
  "retard",
  "nigger",
  "cunt",
  "asshole",
  "puta madre",
  "maricon",
  "maricón",
  "gilipollas",
];

export type ModerationResult =
  | { ok: true }
  | { ok: false; reason: "contact" | "offensive"; message: string };

export function moderateText(text: string, lang: "pt" | "en" | "es" = "pt"): ModerationResult {
  const normalized = text.toLowerCase();

  const contactMsg = {
    pt: "Não é permitido compartilhar redes sociais, telefone ou e-mail no chat.",
    en: "Sharing social networks, phone numbers or emails is not allowed in chat.",
    es: "No se permite compartir redes sociales, teléfono o correo en el chat.",
  }[lang];

  const offensiveMsg = {
    pt: "Sua mensagem contém linguagem ofensiva e foi bloqueada.",
    en: "Your message contains offensive language and was blocked.",
    es: "Tu mensaje contiene lenguaje ofensivo y fue bloqueado.",
  }[lang];

  if (EMAIL.test(text) || PHONE.test(text) || SOCIAL_PATTERNS.some((r) => r.test(text))) {
    return { ok: false, reason: "contact", message: contactMsg };
  }

  const stripped = normalized.replace(/[^a-zà-ú\s]/gi, " ");
  if (OFFENSIVE.some((w) => stripped.includes(w))) {
    return { ok: false, reason: "offensive", message: offensiveMsg };
  }

  return { ok: true };
}
