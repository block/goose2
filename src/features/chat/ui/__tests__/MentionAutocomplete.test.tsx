import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MentionAutocomplete,
  type FileMentionItem,
} from "../MentionAutocomplete";
import { Popover, PopoverAnchor } from "@/shared/ui/popover";
import type { Persona } from "@/shared/types/agents";

const PERSONAS: Persona[] = [
  {
    id: "solo",
    displayName: "Solo",
    systemPrompt: "",
    isBuiltin: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "reviewer",
    displayName: "Reviewer",
    systemPrompt: "",
    isBuiltin: true,
    createdAt: "",
    updatedAt: "",
  },
];

const FILES: FileMentionItem[] = Array.from({ length: 12 }, (_, i) => ({
  resolvedPath: `/project/src/file${i}.ts`,
  displayPath: `src/file${i}.ts`,
  filename: `file${i}.ts`,
  kind: "file" as const,
}));

function renderAutocomplete(props: {
  selectedIndex?: number;
  personas?: Persona[];
  files?: FileMentionItem[];
  query?: string;
}) {
  return render(
    <Popover open>
      <PopoverAnchor asChild>
        <div />
      </PopoverAnchor>
      <MentionAutocomplete
        personas={props.personas ?? PERSONAS}
        files={props.files ?? FILES}
        query={props.query ?? ""}
        isOpen
        onSelectPersona={vi.fn()}
        onSelectFile={vi.fn()}
        selectedIndex={props.selectedIndex}
      />
    </Popover>,
  );
}

describe("MentionAutocomplete", () => {
  it("renders persona and file items", () => {
    renderAutocomplete({});
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getByText("file0.ts")).toBeInTheDocument();
  });

  it("calls scrollIntoView on the selected item", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(
      <Popover open>
        <PopoverAnchor asChild>
          <div />
        </PopoverAnchor>
        <MentionAutocomplete
          personas={PERSONAS}
          files={FILES}
          query=""
          isOpen
          onSelectPersona={vi.fn()}
          onSelectFile={vi.fn()}
          selectedIndex={0}
        />
      </Popover>,
    );

    scrollIntoView.mockClear();

    rerender(
      <Popover open>
        <PopoverAnchor asChild>
          <div />
        </PopoverAnchor>
        <MentionAutocomplete
          personas={PERSONAS}
          files={FILES}
          query=""
          isOpen
          onSelectPersona={vi.fn()}
          onSelectFile={vi.fn()}
          selectedIndex={10}
        />
      </Popover>,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("marks only the selected item as aria-selected", () => {
    renderAutocomplete({ selectedIndex: 3 });

    const options = screen.getAllByRole("option");
    // Index 3 = file index 1 (after 2 personas)
    for (let i = 0; i < options.length; i++) {
      if (i === 3) {
        expect(options[i]).toHaveAttribute("aria-selected", "true");
      } else {
        expect(options[i]).toHaveAttribute("aria-selected", "false");
      }
    }
  });

  it("filters items by query", () => {
    renderAutocomplete({ query: "review" });

    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    expect(screen.queryByText("Solo")).not.toBeInTheDocument();
    // No files match "review"
    expect(screen.queryByText("file0.ts")).not.toBeInTheDocument();
  });

  it("returns null when not open", () => {
    const { container } = render(
      <Popover open>
        <PopoverAnchor asChild>
          <div />
        </PopoverAnchor>
        <MentionAutocomplete
          personas={PERSONAS}
          files={FILES}
          query=""
          isOpen={false}
          onSelectPersona={vi.fn()}
          onSelectFile={vi.fn()}
        />
      </Popover>,
    );

    expect(container.querySelector("[role='listbox']")).not.toBeInTheDocument();
  });
});
