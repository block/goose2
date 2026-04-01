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

  it("ignores include lines after prompt content begins", () => {
    expect(parseEditorText("prompt first\ninclude: /tmp/kept")).toEqual({
      prompt: "prompt first",
      workingDirs: ["/tmp/kept"],
    });
  });

  it("appends a directory after the existing prompt text", () => {
    expect(insertWorkingDir("Existing prompt", "/tmp/one")).toBe(
      "Existing prompt\ninclude: /tmp/one",
    );
  });

  it("appends a directory to the bottom of the editor text", () => {
    expect(
      insertWorkingDir("include: /tmp/one\n\nPrompt body", "/tmp/two"),
    ).toBe("include: /tmp/one\n\nPrompt body\ninclude: /tmp/two");
  });

  it("treats tilde and absolute paths as equivalent when checking duplicates", () => {
    expect(
      hasEquivalentWorkingDir(
        "Prompt body\ninclude: ~/dev/goose2",
        "/Users/mtoohey/dev/goose2",
        "/Users/mtoohey",
      ),
    ).toBe(true);
  });

  it("does not match different directories when checking duplicates", () => {
    expect(
      hasEquivalentWorkingDir(
        "Prompt body\ninclude: ~/dev/goose2",
        "/Users/mtoohey/dev/other",
        "/Users/mtoohey",
      ),
    ).toBe(false);
  });
});
