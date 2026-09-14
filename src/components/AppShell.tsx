import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Home,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { LocaleToggle } from "@/components/LocaleToggle";
import { useSession } from "@/features/auth/session";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NavItem = { to: string; icon: LucideIcon; label: TranslationKey };

const COMPANY_NAV: NavItem[] = [
  { to: "/app/schedule", icon: CalendarDays, label: "nav.schedule" },
  { to: "/app/clients", icon: Users, label: "nav.clients" },
  { to: "/app/market", icon: Search, label: "nav.market" },
  { to: "/app/payouts", icon: Wallet, label: "nav.reports" },
  { to: "/app/messages", icon: MessageCircle, label: "nav.messages" },
];

const WORKER_NAV: NavItem[] = [
  { to: "/app/today", icon: CalendarDays, label: "nav.today" },
  { to: "/app/market", icon: Search, label: "nav.market" },
  { to: "/app/payouts", icon: Wallet, label: "nav.earnings" },
  { to: "/app/messages", icon: MessageCircle, label: "nav.messages" },
  { to: "/app/profile", icon: Sparkles, label: "nav.profile" },
];

const CUSTOMER_NAV: NavItem[] = [
  { to: "/app/visits", icon: Home, label: "nav.visits" },
  { to: "/app/messages", icon: MessageCircle, label: "nav.messages" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { account, isManager } = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const role = account?.primary_role ?? "owner";
  const items =
    role === "customer" ? CUSTOMER_NAV : role === "worker" && !isManager ? WORKER_NAV : COMPANY_NAV;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link to="/app" className="text-base font-semibold tracking-tight">
            {t("app.name")}
          </Link>
          <div className="flex items-center gap-1">
            <LocaleToggle />
            <Link
              to="/app/settings"
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("nav.settings")}
            >
              <Settings className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-stretch justify-around px-2 py-1.5">
          {items.map(({ to, icon: Icon, label }) => {
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
                <Icon className="size-5" />
                {t(label)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
