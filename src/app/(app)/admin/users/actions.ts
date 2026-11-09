"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { toResult, type Result } from "@/lib/result";
import { requireRole, type SessionUser } from "@/server/auth/session";
import {
  activateUser,
  approveUser,
  rejectUser,
  setRole,
  suspendUser,
} from "@/server/users";

export type ActionState = Result<void> | null;

const ROLES: Role[] = ["BORROWER", "STAFF", "ADMIN"];

async function run(fn: (actor: SessionUser) => Promise<void>): Promise<ActionState> {
  const result = await toResult(async () => fn(await requireRole("ADMIN")));
  revalidatePath("/admin/users");
  return result;
}

export async function approveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run((a) => approveUser(a, String(fd.get("userId"))));
}
export async function rejectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run((a) => rejectUser(a, String(fd.get("userId"))));
}
export async function suspendAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run((a) => suspendUser(a, String(fd.get("userId"))));
}
export async function activateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run((a) => activateUser(a, String(fd.get("userId"))));
}
export async function setRoleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const role = String(fd.get("role")) as Role;
  if (!ROLES.includes(role)) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  return run((a) => setRole(a, String(fd.get("userId")), role));
}
