import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { I18nProvider } from "@/lib/i18n";
import { SessionProvider } from "@/features/auth/session";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "CleanConnect" },
      {
        name: "description",
        content:
          "Gestão de empresas de limpeza e mercado de trabalho entre companhias e profissionais.",
      },
      { property: "og:title", content: "CleanConnect" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SessionProvider>
          <Outlet />
          <Toaster position="top-center" richColors />
        </SessionProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function NotFound() {
  return (
    <CenteredMessage title="404" body="Esta página não existe.">
      <Link to="/" className="text-sm font-medium text-primary underline">
        Voltar ao início
      </Link>
    </CenteredMessage>
  );
}

function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "root_error_component" });
  }, [error]);

  return (
    <CenteredMessage title="Algo deu errado" body="Tente de novo em alguns instantes.">
      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="text-sm font-medium text-primary underline"
      >
        Tentar de novo
      </button>
    </CenteredMessage>
  );
}

function CenteredMessage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
