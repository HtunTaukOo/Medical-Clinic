import type { ReactNode } from "react";
import { AppSidebar, type SidebarNavItem } from "@/components/app-sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export type NavItem = SidebarNavItem;

export async function AppShell({
  locale,
  userName,
  roleLabel,
  navItems,
  contentClassName,
  sidebarDark,
  children,
}: {
  locale: string;
  userName: string;
  roleLabel: string;
  navItems: SidebarNavItem[];
  contentClassName?: string;
  sidebarDark?: boolean;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className={sidebarDark ? "sidebar-dark contents" : "contents"}>
        <AppSidebar
          navItems={navItems}
          userName={userName}
          roleLabel={roleLabel}
          signOutSlot={<SignOutButton locale={locale} />}
        />
      </div>
      <SidebarInset className="bg-transparent">
        <header className="flex items-center justify-between border-b border-border/60 bg-card/40 px-4 py-3 backdrop-blur-md md:px-6">
          <SidebarTrigger />
        </header>
        <main className={cn("flex-1 p-4 md:p-8", contentClassName)}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
