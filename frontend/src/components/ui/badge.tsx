import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../libs/utils";

/**
 * Badge component
 *
 * Usage:
 * ```tsx
 * import { Badge } from "@/components/ui/badge";
 *
 * <Badge variant="success">Active</Badge>
 * ```
 */

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground ring-transparent",
        secondary: "bg-muted text-foreground ring-muted-foreground/10",
        success: "bg-green-600/10 text-green-700 ring-green-600/20",
        danger: "bg-red-600/10 text-red-700 ring-red-600/20",
        warning: "bg-yellow-500/10 text-yellow-700 ring-yellow-500/20",
        info: "bg-blue-600/10 text-blue-700 ring-blue-600/20",
        outline: "bg-transparent text-foreground ring-border",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-sm px-3 py-0.5",
        lg: "text-base px-3.5 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
