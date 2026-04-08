import { describe, expect, it } from "vitest";
import { parseImportedSession } from "./importSession";

describe("parseImportedSession", () => {
  it("parses a valid v1 export", () => {
    const json = JSON.stringify({
      version: 1,
      exportedAt: "2026-04-07T12:00:00Z",
      session: {
        title: "Test Chat",
        createdAt: "2026-04-07T10:00:00Z",
        updatedAt: "2026-04-07T11:00:00Z",
        messageCount: 1,
      },
      messages: [
        {
          id: "m1",
          role: "user",
          created: 1000,
          content: [{ type: "text", text: "hello" }],
        },
      ],
    });

    const result = parseImportedSession(json);
    expect(result.session.title).toBe("Test Chat");
    expect(result.messages).toHaveLength(1);
  });

  it("parses OG goose format without version field", () => {
    const json = JSON.stringify({
      id: "old-id",
      name: "OG Session",
      working_dir: "/some/path",
      message_count: 2,
      created_at: "2026-04-07T10:00:00Z",
      updated_at: "2026-04-07T11:00:00Z",
      conversation: [
        {
          role: "user",
          content: [{ type: "text", text: "hi" }],
          created: 1000,
        },
        {
          role: "assistant",
          content: [{ type: "text", text: "hello" }],
          created: 2000,
        },
      ],
    });

    const result = parseImportedSession(json);
    expect(result.session.title).toBe("OG Session");
    expect(result.messages).toHaveLength(2);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseImportedSession("not json")).toThrow();
  });

  it("throws when messages array is missing", () => {
    const json = JSON.stringify({ session: { title: "No Messages" } });
    expect(() => parseImportedSession(json)).toThrow("missing messages");
  });
});
