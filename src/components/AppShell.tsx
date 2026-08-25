import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clapperboard, Heart, MessageCircle, User, Users, Crown } from "lucide-react";
import logoIcon from "@/assets/movie-match-icon.png.asset.json";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const items = [
  { to: "/descobrir", icon: Clapperboard, key: "discover" },
  { to: "/comunidades", icon: Users, key: "communities" },
  { to: "/pessoas", icon: Heart, key: "people" },
  { to: "/chats", icon: MessageCircle, key: "chats" },
  { to: "/perfil", icon: User, key: "profile" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (profile && !profile.onboarding_done && pathname !== "/onboarding") {
      void navigate({ to: "/onboarding" });
    }
  }, [profile, pathname, navigate]);


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link to="/descobrir" className="flex items-center gap-2">
            <img src={logoIcon.url} alt="Movie Match" className="size-7 rounded-lg" />
            <span className="font-display text-2xl leading-none text-gradient-cine">
              Movie Match
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/listas"
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t("lists")}
            </Link>
            <Link
              to="/sessoes"
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t("sessions")}
            </Link>
            <Link
              to="/premium"
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                profile?.is_premium ? "text-gold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Crown className="size-3.5" />
              {t("premium")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-stretch justify-around px-2 py-1.5">
          {items.map(({ to, icon: Icon, key }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "fill-primary/20")} />
                {t(key)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
