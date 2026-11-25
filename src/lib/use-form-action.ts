"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

/**
 * useActionState for forms, without React 19's automatic form reset.
 *
 * Passing the action as `<form action>` makes React clear every field after each
 * submit — so a validation error wipes what the user typed. Submitting through
 * onSubmit keeps the input; `resetOnSuccess` clears it only when the action worked
 * (add forms), and `confirm` asks before destructive actions (delete).
 */
export function useFormAction<S>(
  action: (prev: Awaited<S>, fd: FormData) => Promise<S>,
  initial: Awaited<S>,
  opts: { resetOnSuccess?: boolean; confirm?: string } = {},
) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (opts.resetOnSuccess && (state as { ok?: unknown } | null | undefined)?.ok === true) ref.current?.reset();
  }, [state, opts.resetOnSuccess]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (opts.confirm && !window.confirm(opts.confirm)) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }

  return { state, pending, form: { ref, onSubmit } };
}
