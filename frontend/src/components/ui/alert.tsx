import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, CircleAlert, Info, XCircle } from "lucide-react";
import * as React from "react";

/**
 * Alert component
 *
 * Usage:
 * ```tsx
 * import { Alert, AlertDescription } from "@/components/ui/alert";
 *
 * <Alert variant="warning">
 *   <AlertDescription>Low disk space</AlertDescription>
 * </Alert>
 * ```
 */

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 pr-6 text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-foreground",
  {
    variants: {
      variant: {
        default: "bg-muted/50 border-border/50 text-foreground",
        info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800/30 dark:text-blue-300",
        success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800/30 dark:text-green-300",
        warning: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/30 dark:border-yellow-800/30 dark:text-yellow-300",
        danger: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800/30 dark:text-red-300",
        outline: "bg-transparent border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const variantIconMap: Record<string, React.ReactNode> = {
  default: <CircleAlert className="mr-2" aria-hidden />,
  info: <Info className="mr-2" aria-hidden />,
  success: <CheckCircle2 className="mr-2" aria-hidden />,
  warning: <AlertTriangle className="mr-2" aria-hidden />,
  danger: <XCircle className="mr-2" aria-hidden />,
  outline: <CircleAlert className="mr-2" aria-hidden />,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /**
   * Pass `false` to hide the default icon.
   */
  showIcon?: boolean;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, variant, showIcon = true, children, ...props }, ref) => {
  const icon = variantIconMap[variant ?? "default"];
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {showIcon && icon}
      {children}
    </div>
  );
});
Alert.displayName = "Alert";

export interface AlertDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

function AlertDescription({ className, ...props }: AlertDescriptionProps) {
  return (
    <p className={cn("leading-relaxed", className)} {...props} />
  );
}

export { Alert, AlertDescription, alertVariants };
