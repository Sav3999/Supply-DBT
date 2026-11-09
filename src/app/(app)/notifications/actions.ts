"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/session";
import { markAllRead } from "@/server/notifications";

export async function markAllReadAction(): Promise<void> {
  const user = await requireRole("BORROWER", "STAFF", "ADMIN");
  await markAllRead(user.id);
  revalidatePath("/notifications");
}
