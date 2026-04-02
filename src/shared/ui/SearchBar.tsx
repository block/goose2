import { Search } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface SearchBarProps {
  /** Current search value (controlled) */
  value: string;
  /** Called when the search term changes */
  onChange: (term: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Optional className for the wrapper */
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  className,
}: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background py-2 pr-3 pl-9 text-sm placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}
