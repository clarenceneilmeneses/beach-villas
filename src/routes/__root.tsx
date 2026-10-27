import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Link, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#ffffff" },
      { title: "Patungan Beach · Lerma & Berto Libay Cottages" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Karla:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: Shell,
  component: Root,
  notFoundComponent: () => (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-display text-6xl">404</p>
      <p className="text-muted-foreground">This page doesn't exist.</p>
      <Link to="/" search={{}} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Back home</Link>
    </div>
  ),
});

/** The guest site and the admin share the tokens; `data-site` switches the guest-only bits, as in Malaya. */
function Shell({ children }: { children: ReactNode }) {
  const admin = useRouterState({ select: (s) => s.location.pathname.startsWith("/admin") });
  return (
    <html lang="en" data-site={admin ? undefined : "public"}>
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

function Root() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
