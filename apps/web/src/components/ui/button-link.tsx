import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkVariant = "brand" | "quiet";

const variantClass = {
  brand: "bg-brand text-on-brand hover:bg-ink",
  quiet: "bg-surface-muted text-ink hover:bg-line",
} satisfies Record<ButtonLinkVariant, string>;

type ButtonLinkProps = {
  href: Route;
  variant: ButtonLinkVariant;
  children: ReactNode;
  className?: string;
};

export function ButtonLink({ href, variant, children, className = "" }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`${variantClass[variant]} ${className} inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 text-body font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none`}
    >
      {children}
    </Link>
  );
}
