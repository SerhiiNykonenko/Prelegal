import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/LoginForm";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const loginMock = vi.fn();
const saveSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/api", () => ({
  login: (...args: unknown[]) => loginMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  saveSession: (...args: unknown[]) => saveSessionMock(...args),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    loginMock.mockReset();
    saveSessionMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a validation error when fields are empty", async () => {
    render(<LoginForm />);

    await userEvent.click(screen.getByRole("button", { name: "Enter workspace" }));

    expect(await screen.findByText("Email and password are required.")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("logs in and redirects on success", async () => {
    loginMock.mockResolvedValue({ user: { id: 7, email: "user@example.com" } });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Enter workspace" }));

    expect(loginMock).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" });
    expect(saveSessionMock).toHaveBeenCalledWith({ id: 7, email: "user@example.com" });
    expect(pushMock).toHaveBeenCalledWith("/app");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows backend errors", async () => {
    loginMock.mockRejectedValue(new Error("Login failed"));
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Enter workspace" }));

    expect(await screen.findByText("Login failed")).toBeInTheDocument();
  });
});
