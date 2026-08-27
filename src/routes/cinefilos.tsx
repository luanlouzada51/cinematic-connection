import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clapperboard, Heart, MessageCircle, ShieldCheck, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import logoIcon from "@/assets/movie-match-icon.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/cinefilos")({
  head: () => ({
    meta: [
      { title: "Match por gosto de cinema — Movie Match" },
      {
        name: "description",
        content:
          "Avalie filmes e séries e conheça gente de 18+ no Brasil com o mesmo gosto de cinema. Cadastro grátis em menos de um minuto.",
      },
      { property: "og:title", content: "Match por gosto de cinema — Movie Match" },
      {
        property: "og:description",
        content:
          "Avalie filmes e séries e conheça gente de 18+ no Brasil com o mesmo gosto de cinema. Cadastro grátis em menos de um minuto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CinefilosLanding,
});

const steps = [
  {
    icon: Clapperboard,
    title: "Deslize por filmes e séries",
    text: "Salve o que quer assistir, descarte o que não é a sua praia e avalie o que já viu.",
  },
  {
    icon: Sparkles,
    title: "A gente calcula seu gosto",
    text: "Suas notas viram um perfil de gosto por gênero, sem você preencher formulário nenhum.",
  },
  {
    icon: Heart,
    title: "Match com quem combina",
    text: "Cada pessoa aparece com a porcentagem de afinidade de cinema com você.",
  },
  {
    icon: MessageCircle,
    title: "Conversa com assunto",
    text: "Deu match, abre o chat. E já começa com filme em comum para falar.",
  },
];

function CinefilosLanding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/descobrir" });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (!adult) throw new Error("Você precisa ter 18 anos ou mais para criar uma conta.");
      if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
      if (password !== password2) throw new Error("As senhas não são iguais.");
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/descobrir` },
      });
      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          throw new Error("Esse e-mail já tem conta. Entre com a senha ou use o Google.");
        }
        if (error.message.toLowerCase().includes("weak")) {
          throw new Error("Senha muito fraca ou vazada. Escolha uma senha mais forte.");
        }
        throw error;
      }
      toast.success("Conta criada! Bora montar seu perfil.");
      void navigate({ to: "/descobrir" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar a conta");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (!adult) {
      toast.error("Confirme que você tem 18 anos ou mais para continuar.");
      return;
    }
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        toast.error(result.error.message ?? "Não foi possível entrar com Google.");
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.error("O Google autorizou o acesso, mas a sessão não foi salva. Tente novamente.");
        return;
      }
      await navigate({ to: "/descobrir", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no login com Google");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-reel">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoIcon.url} alt="Movie Match" className="size-9 rounded-xl" />
          <span className="font-display text-3xl leading-none text-gradient-cine">Movie Match</span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">Já tenho conta</Link>
        </Button>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-12 pt-6 md:grid-cols-2 md:items-center md:pt-14">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
            <Star className="size-3.5 fill-gold" /> Grátis · 18+ · Brasil
          </p>
          <h1 className="max-w-xl text-5xl leading-[0.95] md:text-7xl">
            Match com quem ama o mesmo cinema que você
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
            Nada de papo furado no vazio. Você avalia filmes e séries, o Movie Match calcula seu
            gosto e mostra pessoas com a afinidade de cinema em porcentagem. O assunto já vem junto.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-foreground/90">
            <li className="flex items-center gap-2">
              <Heart className="size-4 text-primary" /> Afinidade calculada pelas suas notas, não
              por chute
            </li>
            <li className="flex items-center gap-2">
              <Clapperboard className="size-4 text-primary" /> Catálogo com clássicos brasileiros e
              hits internacionais
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Chat moderado, com bloquear e denunciar
              a um toque
            </li>
          </ul>
        </div>

        <div id="cadastro" className="rounded-3xl border border-border bg-card p-6 shadow-cine">
          <h2 className="text-3xl">Criar conta grátis</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">
            Leva menos de um minuto. Só para maiores de 18 anos.
          </p>

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lp-email">E-mail</Label>
              <Input
                id="lp-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-password">Senha</Label>
              <Input
                id="lp-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-password2">Confirmar senha</Label>
              <Input
                id="lp-password2"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
              <Checkbox
                checked={adult}
                onCheckedChange={(v) => setAdult(v === true)}
                aria-label="Confirmo que tenho 18 anos ou mais"
              />
              <span>Confirmo que tenho 18 anos ou mais.</span>
            </label>
            <Button type="submit" className="w-full shadow-cine" disabled={busy}>
              Criar conta e começar
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={() => void google()}
          >
            Continuar com Google
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/auth" className="text-foreground underline">
              Entrar
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16">
        <h2 className="mb-6 text-center text-4xl">Como funciona</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur"
            >
              <Icon className="mb-3 size-6 text-primary" />
              <p className="font-display text-2xl leading-tight">{title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-gold/30 bg-gold/5 p-8 text-center">
          <p className="font-display text-4xl leading-tight">
            Seu próximo date começa num filme em comum
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Comunidades por gênero, watch parties e listas colaborativas também estão te esperando
            lá dentro.
          </p>
          <Button asChild size="lg" className="mt-1 shadow-cine">
            <a href="#cadastro">Criar minha conta grátis</a>
          </Button>
        </div>
      </section>
    </div>
  );
}
