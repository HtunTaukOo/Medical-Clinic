"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavTransitionContextValue = {
  pendingHref: string | null;
  navigate: (href: string) => void;
};

const NavTransitionContext = React.createContext<NavTransitionContextValue | null>(null);

// Exported for AppSidebar's nav links (and anywhere else that wants to
// trigger a full-route navigation through this same pending state) to read
// pendingHref / call navigate().
export function useNavTransition() {
  const ctx = React.useContext(NavTransitionContext);
  if (!ctx) {
    throw new Error("useNavTransition must be used within a NavTransitionProvider");
  }
  return ctx;
}

// Wraps the whole app shell (sidebar + main content) so clicking a sidebar
// nav link gives instant feedback — the mobile drawer closes immediately,
// a thin indeterminate progress bar sweeps across the top of the screen,
// and the outgoing page content fades out — instead of the UI just sitting
// there unresponsive for however long the next page's server round-trip
// takes (previously the only feedback was a small spinner icon parked in
// the clicked sidebar row, which read as stuck/broken rather than "loading").
export function NavTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isPending, startTransition] = React.useTransition();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  const navigate = React.useCallback(
    (href: string) => {
      if (isMobile) setOpenMobile(false);
      setPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [router, isMobile, setOpenMobile]
  );

  const active = isPending ? pendingHref : null;

  return (
    <NavTransitionContext.Provider value={{ pendingHref: active, navigate }}>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/15 transition-opacity duration-300",
          active ? "opacity-100" : "opacity-0"
        )}
      >
        {active && (
          <div className="h-full w-1/3 rounded-full bg-primary [animation:nav-progress-sweep_1.1s_ease-in-out_infinite]" />
        )}
      </div>
      {children}
    </NavTransitionContext.Provider>
  );
}

// Wraps the page content (AppShell's <main>) so it fades out while a nav
// transition is pending, instead of just abruptly freezing/swapping once
// the new page finally arrives.
export function NavTransitionContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pendingHref } = useNavTransition();
  return (
    <div
      className={cn(
        "transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        pendingHref ? "pointer-events-none opacity-40" : "opacity-100",
        className
      )}
    >
      {children}
    </div>
  );
}
