import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Message } from "@/shared/types/messages";
import {
  ArtifactPolicyProvider,
  useArtifactPolicyContext,
} from "../ArtifactPolicyContext";

function Probe({
  readArgs,
  writeArgs,
  clonedWriteArgs,
}: {
  readArgs: Record<string, unknown>;
  writeArgs: Record<string, unknown>;
  clonedWriteArgs: Record<string, unknown>;
}) {
  const { resolveToolCardDisplay } = useArtifactPolicyContext();
  const readDisplay = resolveToolCardDisplay(readArgs, "read_file");
  const writeDisplay = resolveToolCardDisplay(writeArgs, "write_file");
  const clonedDisplay = resolveToolCardDisplay(clonedWriteArgs, "write_file");

  return (
    <div>
      <span data-testid="read-role">{readDisplay.role}</span>
      <span data-testid="write-role">{writeDisplay.role}</span>
      <span data-testid="write-primary">
        {writeDisplay.primaryCandidate?.resolvedPath ?? ""}
      </span>
      <span data-testid="write-secondary-count">
        {String(writeDisplay.secondaryCandidates.length)}
      </span>
      <span data-testid="cloned-role">{clonedDisplay.role}</span>
    </div>
  );
}

function AllowedProbe({
  args,
  name,
}: {
  args: Record<string, unknown>;
  name: string;
}) {
  const { resolveToolCardDisplay } = useArtifactPolicyContext();
  const display = resolveToolCardDisplay(args, name);

  return (
    <div>
      <span data-testid="role">{display.role}</span>
      <span data-testid="primary-path">
        {display.primaryCandidate?.resolvedPath ?? ""}
      </span>
      <span data-testid="primary-allowed">
        {String(display.primaryCandidate?.allowed ?? "")}
      </span>
      <span data-testid="secondary-count">
        {String(display.secondaryCandidates.length)}
      </span>
    </div>
  );
}

describe("ArtifactPolicyContext", () => {
  it("computes one primary host per message and resolves tool cards by args identity", () => {
    const readArgs = { path: "/Users/test/project-a/notes.md" };
    const writeArgs = {
      paths: [
        "/Users/test/project-a/output/final_report.md",
        "/Users/test/project-a/output/notes.md",
      ],
    };
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        created: Date.now(),
        content: [
          {
            type: "toolRequest",
            id: "tool-1",
            name: "read_file",
            arguments: readArgs,
            status: "completed",
          },
          {
            type: "toolResponse",
            id: "tool-1",
            name: "read_file",
            result: "Read /Users/test/project-a/notes.md",
            isError: false,
          },
          {
            type: "toolRequest",
            id: "tool-2",
            name: "write_file",
            arguments: writeArgs,
            status: "completed",
          },
          {
            type: "toolResponse",
            id: "tool-2",
            name: "write_file",
            result: "Created /Users/test/project-a/output/final_report.md",
            isError: false,
          },
        ],
      },
    ];

    render(
      <ArtifactPolicyProvider
        messages={messages}
        allowedRoots={["/Users/test/project-a", "/Users/test/.goose/artifacts"]}
      >
        <Probe
          readArgs={readArgs}
          writeArgs={writeArgs}
          clonedWriteArgs={{ ...writeArgs }}
        />
      </ArtifactPolicyProvider>,
    );

    expect(screen.getByTestId("read-role")).toHaveTextContent("none");
    expect(screen.getByTestId("write-role")).toHaveTextContent("primary_host");
    expect(screen.getByTestId("write-primary")).toHaveTextContent(
      "/Users/test/project-a/output/final_report.md",
    );
    expect(
      Number(screen.getByTestId("write-secondary-count").textContent),
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("cloned-role")).toHaveTextContent("none");
  });

  it("promotes the first allowed candidate to primary when top-ranked is out of scope", () => {
    // Tool call writes to two paths: one outside roots, one inside.
    // The outside path appears first (higher rank) but should be demoted.
    const writeArgs = {
      paths: [
        "/etc/secrets/leaked.txt",
        "/Users/test/project-a/output/report.md",
      ],
    };
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        created: Date.now(),
        content: [
          {
            type: "toolRequest",
            id: "tool-1",
            name: "write_file",
            arguments: writeArgs,
            status: "completed",
          },
          {
            type: "toolResponse",
            id: "tool-1",
            name: "write_file",
            result: "Created files",
            isError: false,
          },
        ],
      },
    ];

    render(
      <ArtifactPolicyProvider
        messages={messages}
        allowedRoots={["/Users/test/project-a"]}
      >
        <AllowedProbe args={writeArgs} name="write_file" />
      </ArtifactPolicyProvider>,
    );

    expect(screen.getByTestId("role")).toHaveTextContent("primary_host");
    // The allowed in-scope path should be primary
    expect(screen.getByTestId("primary-path")).toHaveTextContent(
      "/Users/test/project-a/output/report.md",
    );
    expect(screen.getByTestId("primary-allowed")).toHaveTextContent("true");
    // The out-of-scope path should be in secondary
    expect(
      Number(screen.getByTestId("secondary-count").textContent),
    ).toBeGreaterThanOrEqual(1);
  });
});
