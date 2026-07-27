import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/LoginForm";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const signInMock = vi.fn();
const signUpMock = vi.fn();
const saveSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/api", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
  signUp: (...args: unknown[]) => signUpMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  saveSession: (...args: unknown[]) => saveSessionMock(...args),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    signInMock.mockReset();
    signUpMock.mockReset();
    saveSessionMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a validation error when fields are empty", async () => {
    render(<LoginForm />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Email and password are required.")).toBeInTheDocument();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("signs in and redirects on success", async () => {
    signInMock.mockResolvedValue({ user: { id: 7, email: "user@example.com" } });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signInMock).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" });
    expect(saveSessionMock).toHaveBeenCalledWith({ id: 7, email: "user@example.com" });
    expect(pushMock).toHaveBeenCalledWith("/app");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("switches to sign up and creates an account", async () => {
    signUpMock.mockResolvedValue({ user: { id: 9, email: "user@example.com" } });
    render(<LoginForm />);

    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.type(screen.getByLabelText("Confirm password"), "secret");

    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(signUpMock).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" });
    expect(saveSessionMock).toHaveBeenCalledWith({ id: 9, email: "user@example.com" });
    expect(pushMock).toHaveBeenCalledWith("/app");
  });

  it("rejects mismatched confirm password in sign up mode", async () => {
    render(<LoginForm />);

    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different");

    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("shows backend errors", async () => {
    signInMock.mockRejectedValue(new Error("Invalid email or password"));
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });
});