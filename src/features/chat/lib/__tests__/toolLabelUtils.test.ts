import { describe, it, expect } from "vitest";
import {
  getToolType,
  getToolDetail,
  getToolVerb,
  getToolLabel,
  extractFileDetail,
} from "../toolLabelUtils";

describe("getToolType", () => {
  it("recognizes write-oriented names", () => {
    expect(getToolType("Write")).toBe("write");
    expect(getToolType("Write foo.md")).toBe("write");
    expect(getToolType("write")).toBe("write");
  });

  it("recognizes read-oriented names", () => {
    expect(getToolType("Read")).toBe("read");
    expect(getToolType("readFile")).toBe("read");
    expect(getToolType("read_file")).toBe("read");
  });

  it("recognizes shell commands", () => {
    expect(getToolType("bash")).toBe("shell");
    expect(getToolType("python3 script.py")).toBe("shell");
    expect(getToolType("ls -la")).toBe("shell");
  });

  it("recognizes search tools", () => {
    expect(getToolType("Glob")).toBe("search");
    expect(getToolType("Grep")).toBe("search");
    expect(getToolType("web_search")).toBe("search");
  });

  it("returns undefined for unrecognized names", () => {
    expect(getToolType("Delegate")).toBeUndefined();
    expect(getToolType("Create PDF about whales")).toBeUndefined();
  });
});

describe("getToolDetail", () => {
  it("extracts detail after type alias keyword", () => {
    expect(getToolDetail("Write foo.md")).toBe("foo.md");
    expect(getToolDetail("Read /tmp/bar.txt")).toBe("/tmp/bar.txt");
  });

  it("returns full command for shell commands", () => {
    expect(getToolDetail("python3 create.py")).toBe("python3 create.py");
    expect(getToolDetail("ls -la /tmp")).toBe("ls -la /tmp");
  });

  it("returns undefined for single-token names", () => {
    expect(getToolDetail("Write")).toBeUndefined();
    expect(getToolDetail("Shell")).toBeUndefined();
    expect(getToolDetail("ls")).toBeUndefined();
  });
});

describe("getToolVerb", () => {
  it("returns verb for known types", () => {
    expect(getToolVerb("write")).toBe("Edited");
    expect(getToolVerb("edit")).toBe("Edited");
    expect(getToolVerb("read")).toBe("Read");
    expect(getToolVerb("shell")).toBe("Ran");
    expect(getToolVerb("search")).toBe("Searched");
  });

  it("returns undefined for unknown types", () => {
    expect(getToolVerb(undefined)).toBeUndefined();
    expect(getToolVerb("unknown")).toBeUndefined();
  });
});

describe("getToolLabel", () => {
  it("builds verb + detail for single items", () => {
    expect(getToolLabel("write", 1, "foo.md")).toBe("Edited foo.md");
  });

  it("builds verb + count + noun for groups", () => {
    expect(getToolLabel("write", 3)).toBe("Edited 3 files");
    expect(getToolLabel("shell", 2)).toBe("Ran 2 commands");
  });

  it("returns just verb when no detail", () => {
    expect(getToolLabel("write", 1)).toBe("Edited");
    expect(getToolLabel("shell", 1)).toBe("Ran");
  });

  it("falls back to raw name for unknown types", () => {
    expect(getToolLabel(undefined, 1, undefined, "Delegate")).toBe("Delegate");
    expect(getToolLabel(undefined, 1)).toBe("Tool");
  });
});

describe("extractFileDetail", () => {
  it("extracts from tool name", () => {
    expect(extractFileDetail("Write report.md")).toBe("report.md");
  });

  it("extracts from args path keys", () => {
    expect(extractFileDetail("Write", { file_path: "/tmp/notes.md" })).toBe(
      "notes.md",
    );
    expect(extractFileDetail("Write", { path: "/foo/bar.txt" })).toBe(
      "bar.txt",
    );
  });

  it("extracts from result text", () => {
    expect(
      extractFileDetail(
        "Write",
        {},
        "Created /Users/test/project/output.md (55 lines)",
      ),
    ).toBe("output.md");
  });

  it("prefers tool name over args", () => {
    expect(
      extractFileDetail("Write inline.md", { path: "/tmp/other.md" }),
    ).toBe("inline.md");
  });

  it("skips paths without file extension", () => {
    expect(extractFileDetail("Write", { path: "/tmp" })).toBeUndefined();
  });

  it("returns undefined when nothing found", () => {
    expect(extractFileDetail("Shell")).toBeUndefined();
    expect(extractFileDetail("Shell", {})).toBeUndefined();
  });
});
