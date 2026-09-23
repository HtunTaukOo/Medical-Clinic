"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabTransitionContextValue = {
  pendingHref: string | null;
  navigate: (href: string) => void;
};

const TabTransitionContext = React.createContext<TabTransitionContextValue | null>(null);

// Exported for pages whose tab bar has bespoke markup (not the shared
// Button component) — they call navigate()/read pendingHref directly instead
// of going through TabButton.
export function useTabTransition() {
  const ctx = React.useContext(TabTransitionContext);
  if (!ctx) {
    throw new Error("TabButton/TabTransitionContent must be rendered inside a TabTransitionScope");
  }
  return ctx;
}

// Wraps a "?tab=" style server-driven tab bar (TabButton) and the content it
// switches between (TabTransitionContent) so switching tabs gives instant
// feedback instead of a beat of nothing followed by an abrupt swap. A plain
// <Link> to a new searchParams value has no pending state to hook into —
// this uses useTransition to expose one, gating a spinner on the clicked tab
// and a fade on the old content while the new server payload streams in.
export function TabTransitionScope({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  const navigate = React.useCallback(
    (href: string) => {
      setPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [router]
  );

  return (
    <TabTransitionContext.Provider value={{ pendingHref: isPending ? pendingHref : null, navigate }}>
      {children}
    </TabTransitionContext.Provider>
  );
}

export function TabButton({
  href,
  active,
  className,
  children,
  variant,
  size,
}: {
  href: string;
  active: boolean;
  className?: string;
  children: React.ReactNode;
} & VariantProps<typeof buttonVariants>) {
  const { pendingHref, navigate } = useTabTransition();
  const isThisPending = pendingHref === href;

  return (
    <Button
      type="button"
      variant={variant ?? (active ? "default" : "outline")}
      size={size}
      className={cn("gap-1.5", className)}
      aria-current={active ? "true" : undefined}
      onClick={() => {
        if (active) return;
        navigate(href);
      }}
    >
      {children}
      {isThisPending && <Loader2 className="size-3.5 animate-spin" />}
    </Button>
  );
}

// For tab bars with bespoke markup that isn't the shared Button component
// (e.g. a custom pill/segmented-control look) — same pending-aware behavior
// as TabButton, but the caller supplies the exact active/inactive classes.
export function TabLink({
  href,
  active,
  className,
  activeClassName,
  inactiveClassName,
  children,
}: {
  href: string;
  active: boolean;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  children: React.ReactNode;
}) {
  const { pendingHref, navigate } = useTabTransition();
  const isThisPending = pendingHref === href;

  return (
    <button
      type="button"
      className={cn("inline-flex items-center gap-1.5", className, active ? activeClassName : inactiveClassName)}
      onClick={() => {
        if (active) return;
        navigate(href);
      }}
    >
      {children}
      {isThisPending && <Loader2 className="size-3 animate-spin" />}
    </button>
  );
}

export function TabTransitionContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pendingHref } = useTabTransition();
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
