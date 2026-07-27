import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardHome } from "@/components/DashboardHome";

const getRecentDocumentDraftsMock = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getRecentDocumentDrafts: () => getRecentDocumentDraftsMock(),
  };
});

describe("DashboardHome", () => {
  beforeEach(() => {
    getRecentDocumentDraftsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the empty previous documents state", async () => {
    getRecentDocumentDraftsMock.mockResolvedValue({ drafts: [] });
    render(<DashboardHome />);

    expect(await screen.findByText("Your saved drafts will appear here after you start working on an agreement.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start a new agreement" })).toBeInTheDocument();
  });

  it("renders recent document drafts", async () => {
    getRecentDocumentDraftsMock.mockResolvedValue({
      drafts: [
        {
          documentKey: "mutual-nda",
          status: "review",
          updatedAt: "2026-08-02T00:00:00+00:00",
          documentTitle: "Acme and Beta",
        },
      ],
    });
    render(<DashboardHome />);

    const link = await screen.findByRole("link", { name: /Acme and Beta/i });
    expect(link).toHaveAttribute("href", "/app/agreements/mutual-nda");
    expect(screen.getByText(/review · Updated/i)).toBeInTheDocument();
  });
});