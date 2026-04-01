import { describe, expect, it } from "vitest";
import {
  dedupeAndRankCandidates,
  evaluatePathScope,
  extractToolCallCandidates,
  rankMessageToolArtifacts,
  resolvePathCandidate,
} from "../artifactPathPolicy";

const roots = [
  "/Users/test/project-a",
  "/Users/test/project-b",
  "/Users/test/.goose/artifacts",
];

describe("artifactPathPolicy", () => {
  it("prefers the latest write-oriented tool call over earlier tool calls", () => {
    const ranking = rankMessageToolArtifacts(
      [
        {
          toolCallId: "read-1",
          toolName: "read_file",
          args: { path: "/Users/test/project-a/notes.md" },
          toolCallIndex: 0,
        },
        {
          toolCallId: "write-1",
          toolName: "write_file",
          args: { path: "/Users/test/project-a/result.md" },
          toolCallIndex: 1,
        },
      ],
      roots,
    );

    expect(ranking.primaryToolCallId).toBe("write-1");
    expect(ranking.primaryCandidate?.resolvedPath).toBe(
      "/Users/test/project-a/result.md",
    );
  });

  it("boosts filename and output-directory signals", () => {
    const ranking = rankMessageToolArtifacts(
      [
        {
          toolCallId: "write-1",
          toolName: "write_file",
          args: {
            paths: [
              "/Users/test/project-a/notes.md",
              "/Users/test/project-a/output/final_report.md",
            ],
          },
          toolCallIndex: 0,
        },
      ],
      roots,
    );

    expect(ranking.primaryCandidate?.resolvedPath).toBe(
      "/Users/test/project-a/output/final_report.md",
    );
  });

  it("uses appearance order as tie-breaker when signals are equal", () => {
    const ranking = rankMessageToolArtifacts(
      [
        {
          toolCallId: "write-1",
          toolName: "write_file",
          args: {
            paths: [
              "/Users/test/project-a/a.txt",
              "/Users/test/project-a/b.txt",
            ],
          },
          toolCallIndex: 0,
        },
      ],
      roots,
    );

    expect(ranking.primaryCandidate?.resolvedPath).toBe(
      "/Users/test/project-a/b.txt",
    );
  });

  it("dedupes equivalent resolved paths", () => {
    const candidates = extractToolCallCandidates(
      {
        toolCallId: "write-1",
        toolName: "write_file",
        args: { path: "/Users/test/project-a/report.md" },
        result: "Wrote /Users/test/project-a/report.md successfully",
        toolCallIndex: 0,
      },
      roots,
    );

    const deduped = dedupeAndRankCandidates(candidates);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].resolvedPath).toBe("/Users/test/project-a/report.md");
  });

  it("allows paths inside any configured root and blocks others", () => {
    const resolvedAllowed = resolvePathCandidate(
      "/Users/test/project-b/output/summary.md",
      roots,
    );
    const allowed = evaluatePathScope(resolvedAllowed, roots);
    expect(allowed.allowed).toBe(true);
    expect(allowed.blockedReason).toBeNull();

    const blocked = evaluatePathScope("/Users/test/outside/file.md", roots);
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockedReason).toContain("outside allowed");
  });

  it("keeps write-origin candidates and drops noisy non-write regex candidates", () => {
    const ranking = rankMessageToolArtifacts(
      [
        {
          toolCallId: "ls-1",
          toolName: "ls /Users/test",
          args: {},
          result: "small_business_issues_report.md\nrandom.json",
          toolCallIndex: 0,
        },
        {
          toolCallId: "write-1",
          toolName: "Write weather-dashboard.html",
          args: {},
          result: "Created weather-dashboard.html",
          toolCallIndex: 1,
        },
      ],
      roots,
    );

    expect(ranking.primaryToolCallId).toBe("write-1");
    expect(ranking.primaryCandidate?.resolvedPath).toContain(
      "weather-dashboard.html",
    );
    expect(
      ranking.secondaryCandidates.some((candidate) =>
        candidate.resolvedPath.includes("small_business_issues_report.md"),
      ),
    ).toBe(false);
  });

  it("does not treat html tags as local paths", () => {
    const candidates = extractToolCallCandidates(
      {
        toolCallId: "write-1",
        toolName: "write_file",
        args: {},
        result:
          "</html>\n</body>\n<script>\nCreated /Users/test/project-a/output/report.html",
        toolCallIndex: 0,
      },
      roots,
    );

    expect(
      candidates.some((candidate) => candidate.rawPath.includes("</html>")),
    ).toBe(false);
    expect(
      candidates.some((candidate) => candidate.rawPath.includes("</body>")),
    ).toBe(false);
    expect(
      candidates.some((candidate) =>
        candidate.resolvedPath.includes("/output/report.html"),
      ),
    ).toBe(true);
  });

  it("prefers explicit absolute path from write result when it is allowed", () => {
    const ranking = rankMessageToolArtifacts(
      [
        {
          toolCallId: "write-1",
          toolName: "Write button-interactions.html",
          args: {},
          result:
            "The file has been created at `/Users/test/button-interactions.html`.",
          toolCallIndex: 0,
        },
      ],
      ["/Users/test", "/Users/test/.goose/artifacts"],
    );

    expect(ranking.primaryCandidate?.resolvedPath).toBe(
      "/Users/test/button-interactions.html",
    );
  });

  it("prefers an allowed candidate as primary when top-ranked candidate is blocked", () => {
    const ranking = rankMessageToolArtifacts(
      [
        {
          toolCallId: "write-1",
          toolName: "Write button-interactions.html",
          args: {},
          result:
            "Created `/Users/test/button-interactions.html` successfully.",
          toolCallIndex: 0,
        },
      ],
      ["/Users/test/.goose/artifacts"],
    );

    expect(ranking.primaryCandidate?.allowed).toBe(true);
    expect(ranking.primaryCandidate?.resolvedPath).toBe(
      "/Users/test/.goose/artifacts/button-interactions.html",
    );
    expect(
      ranking.secondaryCandidates.some(
        (candidate) =>
          candidate.resolvedPath === "/Users/test/button-interactions.html" &&
          candidate.allowed === false,
      ),
    ).toBe(true);
  });
});
