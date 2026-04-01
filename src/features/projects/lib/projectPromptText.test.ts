import { describe, expect, it } from "vitest";
import {
  buildEditorText,
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
    expect(parseEditorText("prompt first\ninclude: /tmp/ignored")).toEqual({
      prompt: "prompt first\ninclude: /tmp/ignored",
      workingDirs: [],
    });
  });

  it("inserts a directory before the first prompt line", () => {
    expect(insertWorkingDir("Existing prompt", "/tmp/one")).toBe(
      "include: /tmp/one\nExisting prompt",
    );
  });

  it("appends a directory after existing include and blank header lines", () => {
    expect(
      insertWorkingDir("include: /tmp/one\n\nPrompt body", "/tmp/two"),
    ).toBe("include: /tmp/one\n\ninclude: /tmp/two\nPrompt body");
  });
});
