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

  it("places includes after the prompt text", () => {
    expect(buildEditorText(["/tmp/one"], "My prompt")).toBe(
      "My prompt\n\ninclude: /tmp/one",
    );
  });

  it("handles includes-only text (no prompt)", () => {
    expect(buildEditorText(["/tmp/one", "/tmp/two"], "")).toBe(
      "include: /tmp/one\ninclude: /tmp/two",
    );
  });

  it("keeps blank lines between include lines in the trailing block", () => {
    expect(
      parseEditorText("prompt\n\ninclude: /tmp/one\n\ninclude: /tmp/two"),
    ).toEqual({
      prompt: "prompt",
      workingDirs: ["/tmp/one", "/tmp/two"],
    });
  });

  it("keeps include-looking lines that appear within prompt content", () => {
    expect(
      parseEditorText("include: /tmp/kept\nprompt text\n\ninclude: /tmp/dir"),
    ).toEqual({
      prompt: "include: /tmp/kept\nprompt text",
      workingDirs: ["/tmp/dir"],
    });
  });

  it("creates a trailing include block for prompt-only text", () => {
    expect(insertWorkingDir("Existing prompt", "/tmp/one")).toBe(
      "Existing prompt\n\ninclude: /tmp/one",
    );
  });

  it("appends a directory to the trailing include block", () => {
    expect(
      insertWorkingDir("Prompt body\n\ninclude: /tmp/one", "/tmp/two"),
    ).toBe("Prompt body\n\ninclude: /tmp/one\ninclude: /tmp/two");
  });

  it("handles legacy top-positioned includes by migrating them to the bottom", () => {
    // Old format had includes at the top — parseEditorText should still
    // handle this gracefully when the entire text is just includes.
    expect(parseEditorText("include: /tmp/one\ninclude: /tmp/two")).toEqual({
      prompt: "",
      workingDirs: ["/tmp/one", "/tmp/two"],
    });
  });

  it("treats tilde and absolute paths as equivalent when checking duplicates", () => {
    expect(
      hasEquivalentWorkingDir(
        "Prompt body\n\ninclude: ~/dev/goose2",
        "/Users/mtoohey/dev/goose2",
        "/Users/mtoohey",
      ),
    ).toBe(true);
  });

  it("does not match different directories when checking duplicates", () => {
    expect(
      hasEquivalentWorkingDir(
        "Prompt body\n\ninclude: ~/dev/goose2",
        "/Users/mtoohey/dev/other",
        "/Users/mtoohey",
      ),
    ).toBe(false);
  });

  it("treats trailing slashes as equivalent when checking duplicates", () => {
    expect(
      hasEquivalentWorkingDir(
        "Prompt body\n\ninclude: /Users/mtoohey/dev/goose2/",
        "/Users/mtoohey/dev/goose2",
        "/Users/mtoohey",
      ),
    ).toBe(true);
  });
});
