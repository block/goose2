import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface ToolCallTriggerProps
  extends Omit<ComponentPropsWithoutRef<typeof motion.button>, "children"> {
  label: string;
  detail?: string;
  statusBadge?: React.ReactNode;
  expanded: boolean;
}

export const ToolCallTrigger = forwardRef<
  HTMLButtonElement,
  ToolCallTriggerProps
>(function ToolCallTrigger(
  { label, detail, statusBadge, expanded, className, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      layout
      type="button"
      className={cn(
        "flex w-full items-center gap-1.5 py-px",
        !expanded && "text-foreground",
        className,
      )}
      transition={{ duration: 0.15 }}
      {...rest}
    >
      <motion.span
        layout="position"
        transition={{ duration: 0.15 }}
        className="font-medium text-sm"
      >
        {label}
      </motion.span>
      <AnimatePresence mode="popLayout">
        {!expanded && detail && (
          <motion.span
            key="file-detail"
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="font-medium text-sm"
          >
            {detail}
          </motion.span>
        )}
      </AnimatePresence>
      {statusBadge}
      <motion.div
        layout="position"
        animate={{ rotate: expanded ? 0 : -90 }}
        transition={{ duration: 0.15 }}
      >
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </motion.div>
    </motion.button>
  );
});
