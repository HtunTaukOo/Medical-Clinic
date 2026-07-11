import type { ReactNode } from "react";
import { AppSidebar, type SidebarNavItem } from "@/components/app-sidebar";
import { SignOutButton } from "@/components/sign-out-button";
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
  children,
}: {
  locale: string;
  userName: string;
  roleLabel: string;
  navItems: SidebarNavItem[];
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar
        navItems={navItems}
        userName={userName}
        roleLabel={roleLabel}
        signOutSlot={<SignOutButton locale={locale} />}
      />
      <SidebarInset>
        <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
