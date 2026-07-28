"use client";

import { useActionState } from "react";
import { addInvoiceItem, type InvoiceItemFormState } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddInvoiceItemForm({ invoiceId }: { invoiceId: string }) {
  const boundAction = addInvoiceItem.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState<InvoiceItemFormState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Input name="description" placeholder="Description" className="w-40" required />
      <Input
        name="quantity"
        type="number"
        min={1}
        defaultValue={1}
        className="w-20"
        placeholder="Qty"
        required
      />
      <Input
        name="unitPrice"
        type="number"
        min={0}
        step="0.01"
        className="w-28"
        placeholder="Unit price"
        required
      />
      <Button type="submit" size="sm" disabled={pending}>
        Add item
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}
