"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/primitives";

/**
 * A form's submit button that greys out while its form is being sent, so a second click cannot send it twice.
 * Twice matters here: a repeated sign-up or invitation spends a second email from a small hourly allowance, and a
 * repeated password save is refused because the password has not changed.
 */
export function SubmitButton({ children, pendingText, disabled, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return <Button {...props} disabled={disabled || pending} aria-busy={pending}>{pending && pendingText ? pendingText : children}</Button>;
}
