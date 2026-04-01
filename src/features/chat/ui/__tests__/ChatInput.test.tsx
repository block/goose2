import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ChatInput } from "../ChatInput";
import type { Persona } from "@/shared/types/agents";

const TEST_PERSONAS: Persona[] = [
  {
    id: "builtin-solo",
    displayName: "Solo",
    systemPrompt: "You are Solo.",
    isBuiltin: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "reviewer",
    displayName: "Reviewer",
    systemPrompt: "You are Reviewer, a code review specialist.",
    isBuiltin: true,
    createdAt: "",
    updatedAt: "",
  },
];

function StatefulChatInput({
  onSend = vi.fn(),
}: {
  onSend?: (text: string, personaId?: string) => void;
}) {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    "builtin-solo",
  );

  return (
    <ChatInput
      onSend={onSend}
      personas={TEST_PERSONAS}
      selectedPersonaId={selectedPersonaId}
      onPersonaChange={setSelectedPersonaId}
    />
  );
}

describe("ChatInput", () => {
  it("renders with placeholder text", () => {
    render(<ChatInput onSend={vi.fn()} placeholder="Ask anything..." />);
    expect(screen.getByPlaceholderText("Ask anything...")).toBeInTheDocument();
  });

  it("renders with default placeholder", () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("Message Goose... (type @ to mention)"),
    ).toBeInTheDocument();
  });

  it("calls onSend when Enter is pressed", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "hello");
    await user.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith("hello", undefined);
  });

  it("does not call onSend on Shift+Enter (newline)", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "hello");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows current model name in model picker", () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        currentModel="GPT-4o"
        availableModels={[{ id: "gpt-4o", name: "GPT-4o" }]}
      />,
    );
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
  });

  it("shows default model name in model picker", () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        availableModels={[{ id: "claude-sonnet-4", name: "Claude Sonnet 4" }]}
      />,
    );
    expect(screen.getByText("Claude Sonnet 4")).toBeInTheDocument();
  });

  it("shows default provider label", () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        providers={[{ id: "goose", label: "Goose" }]}
        selectedProvider="goose"
      />,
    );
    expect(screen.getByText("Goose")).toBeInTheDocument();
  });

  it("opens the provider selector menu", async () => {
    const user = userEvent.setup();

    render(
      <ChatInput
        onSend={vi.fn()}
        providers={[
          { id: "goose", label: "Goose" },
          { id: "openai", label: "OpenAI" },
        ]}
        selectedProvider="goose"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /override provider/i }),
    );

    expect(screen.getByText("Provider Override")).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
  });

  it("opens the project selector menu", async () => {
    const user = userEvent.setup();

    render(
      <ChatInput
        onSend={vi.fn()}
        selectedProjectId="project-1"
        availableProjects={[
          {
            id: "project-1",
            name: "goose2",
            workingDir: "/Users/wesb/dev/goose2",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /select project/i }));

    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("No project")).toBeInTheDocument();
  });

  it("shows no project in the toolbar when no project is selected", () => {
    render(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByText("No project")).toBeInTheDocument();
  });

  it("shows the selected project name in the toolbar", () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        selectedProjectId="project-1"
        availableProjects={[
          {
            id: "project-1",
            name: "goose2",
            workingDir: "/Users/wesb/dev/goose2",
          },
        ]}
      />,
    );
    expect(screen.getByText("goose2")).toBeInTheDocument();
  });

  it("shows stop button when streaming", () => {
    render(<ChatInput onSend={vi.fn()} onStop={vi.fn()} isStreaming />);
    expect(
      screen.getByRole("button", { name: /stop generation/i }),
    ).toBeInTheDocument();
  });

  it("calls onStop when stop button clicked", async () => {
    const onStop = vi.fn();
    const user = userEvent.setup();
    render(<ChatInput onSend={vi.fn()} onStop={onStop} isStreaming />);

    await user.click(screen.getByRole("button", { name: /stop generation/i }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    render(<ChatInput onSend={vi.fn()} disabled />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("clears input after sending", async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={vi.fn()} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "hello");
    await user.keyboard("{Enter}");

    expect(input).toHaveValue("");
  });

  it("selecting an @mention creates a sticky assistant chip without leaving inline text", async () => {
    const user = userEvent.setup();
    render(<StatefulChatInput />);

    const input = screen.getByRole("textbox");
    await user.type(input, "@Rev");
    await user.click(screen.getByRole("option", { name: /reviewer/i }));

    expect(input).toHaveValue("");
    expect(screen.getByText("@Reviewer")).toBeInTheDocument();
  });

  it("keeps the selected assistant chip after sending subsequent messages", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<StatefulChatInput onSend={onSend} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "@Rev");
    await user.click(screen.getByRole("option", { name: /reviewer/i }));
    await user.click(input);
    await user.keyboard("{End}");
    await user.type(input, "hello");
    await user.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith("hello", "reviewer");
    expect(screen.getByText("@Reviewer")).toBeInTheDocument();
  });
});
