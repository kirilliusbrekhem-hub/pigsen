import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "light" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
  children: ReactNode;
}

export function btnClass(variant: Variant = "secondary", size: "sm" | "md" | "lg" = "md", extra = "") {
  return ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "", extra].filter(Boolean).join(" ");
}

export function Button({ variant = "secondary", size = "md", loading = false, block = false, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={btnClass(variant, size, `${block ? "btn-block" : ""} ${loading ? "is-loading" : ""} ${className}`)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
