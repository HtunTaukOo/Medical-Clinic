"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChipListInput({
  name,
  defaultValues,
  placeholder,
  joinAsCsv = false,
}: {
  name: string;
  defaultValues: string[];
  placeholder: string;
  joinAsCsv?: boolean;
}) {
  const [chips, setChips] = useState(defaultValues);
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (value && !chips.includes(value)) setChips((prev) => [...prev, value]);
    setDraft("");
  }

  function remove(chip: string) {
    setChips((prev) => prev.filter((c) => c !== chip));
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip}
            className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
          >
            {chip}
            <button
              type="button"
              onClick={() => remove(chip)}
              className="text-blue-500 hover:text-blue-800"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="max-w-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          + Add
        </Button>
      </div>
      {joinAsCsv ? (
        <input type="hidden" name={name} value={chips.join(", ")} />
      ) : (
        chips.map((chip) => <input key={chip} type="hidden" name={name} value={chip} />)
      )}
    </div>
  );
}
