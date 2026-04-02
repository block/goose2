import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArtifactPolicyProvider } from "../../hooks/ArtifactPolicyContext";
import { MarkdownContent } from "../MarkdownContent";

const { openPathMock, pathExistsMock } = vi.hoisted(() => ({
  openPathMock: vi.fn(),
  pathExistsMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: openPathMock,
}));

vi.mock("@/shared/api/system", () => ({
  pathExists: pathExistsMock,
}));

function renderWithPolicy(content: string) {
  return render(
    <ArtifactPolicyProvider
      messages={[]}
      allowedRoots={["/Users/test/project-a", "/Users/test/.goose/artifacts"]}
    >
      <MarkdownContent content={content} />
    </ArtifactPolicyProvider>,
  );
}

describe("MarkdownContent", () => {
  afterEach(() => {
    openPathMock.mockReset();
    pathExistsMock.mockReset();
    pathExistsMock.mockResolvedValue(true);
  });

  it("opens allowed local links through artifact policy", async () => {
    const user = userEvent.setup();
    renderWithPolicy("[report](./output/final_report.md)");

    await user.click(screen.getByRole("link", { name: "report" }));

    expect(openPathMock).toHaveBeenCalledWith(
      "/Users/test/project-a/output/final_report.md",
    );
  });

  it("blocks disallowed local links and shows reason", async () => {
    const user = userEvent.setup();
    renderWithPolicy("[secret](/Users/test/outside/secret.md)");

    await user.click(screen.getByRole("link", { name: "secret" }));

    expect(openPathMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Path is outside allowed project/artifacts roots."),
    ).toBeInTheDocument();
  });

  it("keeps external links unchanged", () => {
    renderWithPolicy("[docs](https://example.com/docs)");

    const external = screen.getByRole("link", { name: "docs" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    expect(openPathMock).not.toHaveBeenCalled();
  });
});
