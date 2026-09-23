import type { ReactNode } from "react";
import { AppSidebar, type SidebarNavItem } from "@/components/app-sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { getClinicSettings } from "@/lib/clinic-hours";
import { cn } from "@/lib/utils";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NavTransitionProvider, NavTransitionContent } from "@/components/nav-transition";

export type NavItem = SidebarNavItem;

export async function AppShell({
  locale,
  userName,
  roleLabel,
  navItems,
  contentClassName,
  sidebarDark,
  hideSectionLabels,
  children,
}: {
  locale: string;
  userName: string;
  roleLabel: string;
  navItems: SidebarNavItem[];
  contentClassName?: string;
  sidebarDark?: boolean;
  hideSectionLabels?: boolean;
  children: ReactNode;
}) {
  const settings = await getClinicSettings();
  return (
    <SidebarProvider>
      <NavTransitionProvider>
        <div className={sidebarDark ? "sidebar-dark contents" : "contents"}>
          <AppSidebar
            navItems={navItems}
            userName={userName}
            roleLabel={roleLabel}
            signOutSlot={<SignOutButton locale={locale} />}
            hideSectionLabels={hideSectionLabels}
            sidebarDark={sidebarDark}
            hasLogo={!!settings.logoData}
          />
        </div>
        <SidebarInset className="bg-transparent">
          <header className="flex items-center justify-between border-b border-border/60 bg-card/40 px-4 py-3 backdrop-blur-md md:px-6">
            <SidebarTrigger />
          </header>
          <NavTransitionContent className="flex flex-1 flex-col">
            <main className={cn("flex-1 p-4 md:p-8", contentClassName)}>{children}</main>
          </NavTransitionContent>
        </SidebarInset>
      </NavTransitionProvider>
    </SidebarProvider>
  );
}
