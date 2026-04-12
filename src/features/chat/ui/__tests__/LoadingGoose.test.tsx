import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingGoose } from "../LoadingGoose";

describe("LoadingGoose", () => {
  it("renders thinking copy for the thinking state", () => {
    render(<LoadingGoose chatState="thinking" />);

    expect(screen.getByRole("status", { name: "Thinking..." })).toBeInTheDocument();
  });

  it("renders responding copy for active response states", () => {
    const { rerender } = render(<LoadingGoose chatState="streaming" />);

    expect(
      screen.getByRole("status", { name: "Responding..." }),
    ).toBeInTheDocument();

    rerender(<LoadingGoose chatState="waiting" />);
    expect(
      screen.getByRole("status", { name: "Responding..." }),
    ).toBeInTheDocument();

    rerender(<LoadingGoose chatState="compacting" />);
    expect(
      screen.getByRole("status", { name: "Responding..." }),
    ).toBeInTheDocument();
  });

  it("renders nothing while idle", () => {
    const { container } = render(<LoadingGoose chatState="idle" />);

    expect(container).toBeEmptyDOMElement();
  });
});
