import { describe, expect, it } from "vitest";
import {
  buildEditorText,
  hasEquivalentWorkingDir,
  insertWorkingDir,
  parseEditorText,
} from "./projectPromptText";

describe("projectPromptText", () => {
  it("round-trips working directories and prompt text", () => {
    const text = buildEditorText(
      ["/tmp/one", "/tmp/two"],
      "Follow AGENTS.md\nThen fix the issue",
    );

    expect(parseEditorText(text)).toEqual({
      prompt: "Follow AGENTS.md\nThen fix the issue",
      workingDirs: ["/tmp/one", "/tmp/two"],
    });
  });

  it("keeps blank lines between include lines and prompt content", () => {
    expect(
      parseEditorText("include: /tmp/one\n\ninclude: /tmp/two\nprompt"),
    ).toEqual({
      prompt: "prompt",
      workingDirs: ["/tmp/one", "/tmp/two"],
    });
  });

  it("keeps include-looking prompt lines after prompt content begins", () => {
    expect(parseEditorText("prompt first\ninclude: /tmp/kept")).toEqual({
      prompt: "prompt first\ninclude: /tmp/kept",
      workingDirs: [],
    });
  });

  it("creates a leading include block for prompt-only text", () => {
    expect(insertWorkingDir("Existing prompt", "/tmp/one")).toBe(
      "include: /tmp/one\n\nExisting prompt",
    );
  });

  it("appends a directory within the leading include block", () => {
    expect(
      insertWorkingDir("include: /tmp/one\n\nPrompt body", "/tmp/two"),
    ).toBe("include: /tmp/one\ninclude: /tmp/two\n\nPrompt body");
  });

  it("treats tilde and absolute paths as equivalent when checking duplicates", () => {
    expect(
      hasEquivalentWorkingDir(
        "include: ~/dev/goose2\n\nPrompt body",
        "/Users/mtoohey/dev/goose2",
        "/Users/mtoohey",
      ),
    ).toBe(true);
  });

  it("does not match different directories when checking duplicates", () => {
    expect(
      hasEquivalentWorkingDir(
        "include: ~/dev/goose2\n\nPrompt body",
        "/Users/mtoohey/dev/other",
        "/Users/mtoohey",
      ),
    ).toBe(false);
  });

  it("treats trailing slashes as equivalent when checking duplicates", () => {
    expect(
      hasEquivalentWorkingDir(
        "include: /Users/mtoohey/dev/goose2/\n\nPrompt body",
        "/Users/mtoohey/dev/goose2",
        "/Users/mtoohey",
      ),
    ).toBe(true);
  });
});
