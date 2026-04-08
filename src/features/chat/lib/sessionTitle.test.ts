import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHAT_TITLE,
  getDisplaySessionTitle,
  getEditableSessionTitle,
  isSessionTitleUnchanged,
} from "./sessionTitle";

describe("sessionTitle", () => {
  it("maps the internal default title to the localized display title", () => {
    expect(getDisplaySessionTitle(DEFAULT_CHAT_TITLE, "Nuevo chat")).toBe(
      "Nuevo chat",
    );
    expect(getEditableSessionTitle(DEFAULT_CHAT_TITLE, "Nuevo chat")).toBe(
      "Nuevo chat",
    );
  });

  it("treats the localized default title as unchanged while the sentinel is still internal", () => {
    expect(
      isSessionTitleUnchanged("Nuevo chat", DEFAULT_CHAT_TITLE, "Nuevo chat"),
    ).toBe(true);
    expect(
      isSessionTitleUnchanged("Renamed chat", DEFAULT_CHAT_TITLE, "Nuevo chat"),
    ).toBe(false);
  });
});
