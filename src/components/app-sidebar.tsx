"use client";

import type { LucideIcon } from "lucide-react";
import {
  HeartPulse,
  LayoutDashboard,
  Users,
  CalendarDays,
  Receipt,
  Pill,
  UserCog,
  Stethoscope,
  CalendarCheck,
  FileText,
  Settings,
  ClipboardList,
  ListOrdered,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LocaleSwitcher } from "@/components/locale-switcher";

export type SidebarNavItem = {
  href: string;
  labelKey: string;
};

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  patients: Users,
  appointments: CalendarDays,
  billing: Receipt,
  inventory: Pill,
  staff: UserCog,
  findDoctors: Stethoscope,
  myAppointments: CalendarCheck,
  myInvoices: FileText,
  settings: Settings,
  medicalRecords: ClipboardList,
  queue: ListOrdered,
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppSidebar({
  navItems,
  userName,
  roleLabel,
  signOutSlot,
}: {
  navItems: SidebarNavItem[];
  userName: string;
  roleLabel: string;
  signOutSlot: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 py-4">
        <div className="flex items-center gap-2 px-1">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HeartPulse className="size-5" />
          </div>
          <div className="grid text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-semibold">{tApp("shortName")}</span>
            <span className="text-xs text-muted-foreground">{roleLabel}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/staff" &&
                item.href !== "/portal" &&
                pathname.startsWith(item.href));
            const Icon = ICONS[item.labelKey] ?? LayoutDashboard;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:hover:bg-sidebar-primary data-[active=true]:hover:text-sidebar-primary-foreground"
                >
                  <Link href={item.href}>
                    <Icon />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="gap-3 px-3 py-4">
        <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:hidden">
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
              {initials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="grid text-sm leading-tight">
            <span className="font-medium">{userName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <LocaleSwitcher />
          {signOutSlot}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
