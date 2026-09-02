"use client";

import type { LucideIcon } from "lucide-react";
import {
  Home,
  LayoutDashboard,
  Users,
  CalendarDays,
  CalendarPlus,
  Receipt,
  Pill,
  UserCog,
  Stethoscope,
  CalendarCheck,
  FileText,
  Settings,
  ClipboardList,
  ListOrdered,
  BarChart3,
  History,
  FlaskConical,
  CalendarOff,
  Bell,
  CircleUserRound,
  Megaphone,
  CalendarRange,
  ClipboardPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ClinicLogo } from "@/components/clinic-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";

export type SidebarNavItem = {
  href: string;
  labelKey: string;
  group?: string;
  badge?: number;
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
  reports: BarChart3,
  activityLog: History,
  lab: FlaskConical,
  labResults: FlaskConical,
  myAvailability: CalendarOff,
  home: Home,
  bookAppointment: CalendarPlus,
  billsPayments: Receipt,
  notifications: Bell,
  profile: CircleUserRound,
  announcements: Megaphone,
  myPatients: Users,
  consultations: ClipboardPlus,
  prescriptions: Pill,
  schedule: CalendarRange,
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
  hideSectionLabels,
}: {
  navItems: SidebarNavItem[];
  hideSectionLabels?: boolean;
  userName: string;
  roleLabel: string;
  signOutSlot: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();

  const groupKeys: (string | undefined)[] = [];
  for (const item of navItems) {
    if (!groupKeys.includes(item.group)) groupKeys.push(item.group);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 py-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:px-0">
          <ClinicLogo className="size-10 shrink-0 rounded-lg shadow-[0_0_0_1px_rgba(21,101,192,0.12),0_6px_18px_-4px_rgba(21,101,192,0.45)] group-data-[collapsible=icon]:size-8" />
          <div className="grid text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-semibold">{tApp("shortName")}</span>
            <span className="text-xs text-sidebar-foreground/60">{roleLabel}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        {groupKeys.map((group) => (
          <SidebarGroup key={group ?? "_"} className="p-0 py-1">
            {group && !hideSectionLabels && <SidebarGroupLabel>{t(group)}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems
                  .filter((item) => item.group === group)
                  .map((item) => {
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
                          className="data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-primary data-[active=true]:hover:bg-sidebar-active data-[active=true]:hover:text-sidebar-primary"
                        >
                          <Link href={item.href}>
                            <Icon />
                            <span>{t(item.labelKey)}</span>
                            {!!item.badge && (
                              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-white">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
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
