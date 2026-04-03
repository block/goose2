import { ChevronLeft, ChevronRight } from "lucide-react";

interface ForkSelectorProps {
  currentIndex: number;
  totalBranches: number;
  onPrev: () => void;
  onNext: () => void;
}

export function ForkSelector({
  currentIndex,
  totalBranches,
  onPrev,
  onNext,
}: ForkSelectorProps) {
  return (
    <div className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentIndex === 0}
        className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-accent disabled:opacity-30"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span className="tabular-nums">
        {currentIndex + 1} / {totalBranches}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex === totalBranches - 1}
        className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-accent disabled:opacity-30"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
