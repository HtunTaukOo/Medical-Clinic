"use client";

import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/expenses";
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
    { value: "all", label: "All Categories" },
    ...(categories ?? EXPENSE_CATEGORIES).map((value) => ({
      value,
      label: EXPENSE_CATEGORY_LABELS[value as keyof typeof EXPENSE_CATEGORY_LABELS],
    })),
  ];

  return (
    <Select value={category} onValueChange={update}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="All Categories" />
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
