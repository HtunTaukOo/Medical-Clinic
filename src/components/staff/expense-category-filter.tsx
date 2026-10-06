"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ExpenseCategoryFilter({
  defaultCategory,
  categories,
}: {
  defaultCategory: string;
  // Restricts the dropdown to a subset (e.g. staff only ever see their own
  // allowed categories) — defaults to every category, for the admin view.
  categories?: readonly string[];
}) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? defaultCategory;

  function update(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === "all") params.delete("category");
    else params.set("category", value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const options = [
    { value: "all", label: t("allCategories") },
    ...(categories ?? EXPENSE_CATEGORIES).map((value) => ({
      value,
      label: t(`category${value.charAt(0)}${value.slice(1).toLowerCase()}`),
    })),
  ];

  return (
    <Select value={category} onValueChange={update}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder={t("allCategories")} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
