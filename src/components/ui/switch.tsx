"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type SwitchProps = {
  label: string;
  name?: string;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
};

/** Accessible toggle (role="switch"). Submits "on" via a hidden input when `name` is set. */
export function Switch({ label, name, defaultChecked = false, onCheckedChange, className }: SwitchProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => {
          setChecked((value) => !value);
          onCheckedChange?.(!checked);
        }}
        className={cn(
          "relative inline-flex h-6 w-[42px] shrink-0 items-center rounded-full border-2 transition-colors",
          checked ? "border-navy bg-navy" : "border-[#c9c9cc] bg-[#d9d9dc]",
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-[18px] rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[19px]" : "translate-x-px",
          )}
        />
      </button>
      {name ? <input type="hidden" name={name} value={checked ? "on" : "off"} /> : null}
    </>
  );
}
