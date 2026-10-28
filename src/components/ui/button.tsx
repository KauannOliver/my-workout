import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" };

export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return <button className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-200", {
    "bg-green-600 text-white shadow-sm hover:bg-green-700": variant === "primary",
    "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white": variant === "secondary",
    "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800": variant === "ghost",
    "bg-red-600 text-white hover:bg-red-700": variant === "danger",
    "px-3 text-sm": size === "sm", "px-4 text-sm": size === "md", "px-6 py-3 text-base": size === "lg",
  }, className)} {...props} />;
}
