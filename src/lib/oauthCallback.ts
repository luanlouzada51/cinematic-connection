import { supabase } from "@/integrations/supabase/client";

type Result = "none" | "ok" | "error";

/**
 * Quando o login social acontece por redirecionamento (site publicado, celular,
 * popup bloqueado), o provedor devolve os tokens na URL. Ninguém consome esses
 * tokens automaticamente, então a pessoa voltava "deslogada" mesmo tendo
 * autorizado. Esta função lê os tokens da URL, cria a sessão e limpa o endereço.
 */
export async function consumeOAuthRedirect(): Promise<Result> {
  if (typeof window === "undefined") return "none";

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const pick = (key: string) => hash.get(key) ?? query.get(key);

  const accessToken = pick("access_token");
  const refreshToken = pick("refresh_token");
  const errorParam = pick("error") ?? pick("error_description");
  const code = pick("code");

  if (!accessToken && !code && !errorParam) return "none";

  const clean = () => {
    const url = new URL(window.location.href);
    [
      "access_token",
      "refresh_token",
      "expires_in",
      "expires_at",
      "token_type",
      "provider_token",
      "code",
      "state",
      "error",
      "error_code",
      "error_description",
    ].forEach((k) => url.searchParams.delete(k));
    url.hash = "";
    window.history.replaceState({}, "", url.pathname + url.search);
  };

  try {
    if (errorParam && !accessToken && !code) {
      clean();
      return "error";
    }

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      clean();
      return error ? "error" : "ok";
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      clean();
      return error ? "error" : "ok";
    }

    clean();
    return "none";
  } catch {
    clean();
    return "error";
  }
}
