import { describe, expect, it } from "vitest";
import {
  buildExportPayload,
  defaultExportFilename,
  type ExportedSession,
} from "./exportSession";
import type { Message } from "@/shared/types/messages";

function makeMessage(text: string): Message {
  return {
    id: "msg-1",
    role: "user",
    created: Date.now(),
    content: [{ type: "text", text }],
    metadata: { userVisible: true },
  };
}

describe("buildExportPayload", () => {
  it("builds a valid export payload with version and metadata", () => {
    const session = {
      title: "Test Chat",
      createdAt: "2026-04-07T10:00:00Z",
      updatedAt: "2026-04-07T11:00:00Z",
      messageCount: 1,
    };
    const messages = [makeMessage("hello")];

    const result: ExportedSession = JSON.parse(
      buildExportPayload(session, messages),
    );

    expect(result.version).toBe(1);
    expect(result.exportedAt).toBeDefined();
    expect(result.session.title).toBe("Test Chat");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content[0]).toEqual({
      type: "text",
      text: "hello",
    });
  });

  it("includes optional session fields when present", () => {
    const session = {
      title: "Project Chat",
      createdAt: "2026-04-07T10:00:00Z",
      updatedAt: "2026-04-07T11:00:00Z",
      messageCount: 0,
      projectId: "proj-1",
      personaId: "persona-1",
      modelName: "claude-4",
    };

    const result: ExportedSession = JSON.parse(buildExportPayload(session, []));

    expect(result.session.projectId).toBe("proj-1");
    expect(result.session.personaId).toBe("persona-1");
    expect(result.session.modelName).toBe("claude-4");
  });

  it("builds a safe default export filename from the session title", () => {
    expect(defaultExportFilename("  Foo:/Bar*Baz  ")).toBe("Foo--Bar-Baz.json");
    expect(defaultExportFilename("")).toBe("session.json");
  });
});
