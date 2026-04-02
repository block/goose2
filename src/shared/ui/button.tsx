import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-background-inverse text-foreground-inverse shadow-sm hover:bg-background-inverse/90",
        destructive:
          "bg-background-danger text-foreground-inverse shadow-sm hover:bg-background-danger/90",
        outline:
          "border border-border bg-background shadow-sm hover:bg-background-secondary hover:text-foreground",
        secondary:
          "bg-background-secondary text-foreground shadow-sm hover:bg-background-secondary/80",
        ghost: "hover:bg-background-secondary hover:text-foreground",
        "ghost-subtle": "text-foreground-secondary hover:text-foreground",
        toolbar:
          "justify-start bg-transparent font-normal text-foreground-secondary shadow-none hover:bg-background-secondary hover:text-foreground active:bg-background-secondary active:text-foreground focus-visible:ring-0 data-[state=open]:bg-background-secondary data-[state=open]:text-foreground aria-expanded:bg-background-secondary aria-expanded:text-foreground",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 rounded-md px-2.5 text-xs",
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        "icon-xs": "h-7 w-7",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-10 w-10",
      },
    },
    compoundVariants: [
      {
        variant: "toolbar",
        size: "xs",
        className: "gap-1.5 px-1.5 text-[13px]",
      },
      {
        variant: "toolbar",
        size: "sm",
        className: "gap-1.5 px-2 text-[13px]",
      },
      {
        variant: "toolbar",
        size: "default",
        className: "gap-1.5 px-2.5 text-[13px]",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
