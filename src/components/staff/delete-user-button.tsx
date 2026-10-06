"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteStaffUser, type DeleteStaffUserState } from "@/actions/staff";

export function DeleteUserButton({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations("userManagement");
  const [state, formAction, pending] = useActionState<DeleteStaffUserState, FormData>(
    deleteStaffUser.bind(null, userId),
    {}
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(t("deleteAccountConfirm", { name }))) e.preventDefault();
      }}
      className="inline-grid justify-items-end gap-1"
    >
      <button
        type="submit"
        disabled={pending}
        className="font-medium text-destructive underline underline-offset-2 disabled:opacity-50"
      >
        {t("delete")}
      </button>
      {state.error && <p className="max-w-48 text-right text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
