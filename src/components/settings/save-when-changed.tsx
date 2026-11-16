"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";

/**
 * A Save button that stays greyed out until something in its form differs from what was there when the row was drawn.
 * Give it a `key` made of the saved values so it starts again from the new values after a save.
 */
export function SaveWhenChanged({ children = "Save" }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const snapshot = () => JSON.stringify([...new FormData(form).entries()].filter(([name, v]) => typeof v === "string" && !name.startsWith("$ACTION")));
    const initial = snapshot();
    const check = () => setDirty(snapshot() !== initial);
    form.addEventListener("input", check);
    form.addEventListener("change", check);
    return () => { form.removeEventListener("input", check); form.removeEventListener("change", check); };
  }, []);

  return <Button ref={ref} size="sm" variant={dirty ? "primary" : "outline"} disabled={!dirty} title={dirty ? "Save this person's role, client and active setting" : "Nothing to save"}>{children}</Button>;
}
