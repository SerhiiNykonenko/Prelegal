import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MutualNdaWorkspace } from "@/components/document-workspace/MutualNdaWorkspace";

function createSession(email: string) {
  window.sessionStorage.setItem("prelegal-session", JSON.stringify({ id: 1, email }));
  document.cookie = `prelegal_session=${encodeURIComponent(email)}; Path=/; SameSite=Lax`;
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body),
  };
}

describe("MutualNdaWorkspace", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    createSession("user@example.com");
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/api/document-drafts/mutual-nda")) {
        return jsonResponse({
          draft: {
            documentKey: "mutual-nda",
            status: "draft",
            inputMode: "form",
            draft: {
              purpose: "",
              effectiveDate: "2026-08-01",
              mndaTermType: "fixed",
              mndaTermYears: 1,
              confidentialityTermType: "fixed",
              confidentialityTermYears: 1,
              governingLaw: "",
              jurisdiction: "",
              modifications: "None.",
              partyOne: { printName: "", title: "", company: "", noticeAddress: "", signatureDate: "2026-08-01" },
              partyTwo: { printName: "", title: "", company: "", noticeAddress: "", signatureDate: "2026-08-02" },
            },
            chat: { messages: [], questionGroups: [] },
          },
        });
      }
      return jsonResponse({ error: "unexpected" }, false);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    document.cookie = "prelegal_session=; Path=/; Max-Age=0; SameSite=Lax";
  });

  it("loads the persisted draft from the backend on mount", async () => {
    render(<MutualNdaWorkspace />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8000/api/document-drafts/mutual-nda",
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );
    });

    expect((screen.getByLabelText("Effective date") as HTMLInputElement).value).toBe("2026-08-01");
  });

  it("blocks the review step and shows errors when required fields are empty", async () => {
    render(<MutualNdaWorkspace />);

    await screen.findByLabelText("Effective date");

    await userEvent.click(screen.getByRole("button", { name: "Review draft" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Review and edit before download" })).toBeInTheDocument();
    });
    expect(screen.getAllByText("Print name is required").length).toBeGreaterThan(0);
  });

  it("switches into chat mode and submits a grouped answer", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/document-drafts/mutual-nda") && (!init || init.method === undefined || init.method === "GET")) {
        return jsonResponse({
          draft: {
            documentKey: "mutual-nda",
            status: "draft",
            inputMode: "form",
            draft: {
              purpose: "",
              effectiveDate: "2026-08-01",
              mndaTermType: "fixed",
              mndaTermYears: 1,
              confidentialityTermType: "fixed",
              confidentialityTermYears: 1,
              governingLaw: "",
              jurisdiction: "",
              modifications: "None.",
              partyOne: { printName: "", title: "", company: "", noticeAddress: "", signatureDate: "2026-08-01" },
              partyTwo: { printName: "", title: "", company: "", noticeAddress: "", signatureDate: "2026-08-02" },
            },
            chat: { messages: [], questionGroups: [] },
          },
        });
      }
      if (url.endsWith("/chat-turn") && init?.method === "POST") {
        return jsonResponse({
          draft: {
            documentKey: "mutual-nda",
            status: "draft",
            inputMode: "chat",
            draft: {
              purpose: "",
              effectiveDate: "2026-08-01",
              mndaTermType: "fixed",
              mndaTermYears: 1,
              confidentialityTermType: "fixed",
              confidentialityTermYears: 1,
              governingLaw: "",
              jurisdiction: "",
              modifications: "None.",
              partyOne: { printName: "", title: "", company: "", noticeAddress: "", signatureDate: "2026-08-01" },
              partyTwo: { printName: "", title: "", company: "", noticeAddress: "", signatureDate: "2026-08-02" },
            },
            chat: {
              messages: [
                { role: "user", content: "Acme + Beta testing." },
                { role: "assistant", content: "Got it. Tell me about governing law next." },
              ],
              questionGroups: [
                {
                  title: "Legal settings",
                  questions: [
                    { key: "governingLaw", prompt: "Which state law should govern the NDA?" },
                  ],
                },
              ],
            },
          },
          assistantMessage: "Got it. Tell me about governing law next.",
          readyForReview: false,
        });
      }
      return jsonResponse({ error: "unexpected" }, false);
    });

    render(<MutualNdaWorkspace />);

    await screen.findByLabelText("Effective date");

    await userEvent.click(screen.getByRole("tab", { name: "Chat" }));

    await userEvent.type(screen.getByLabelText("Your answer"), "Acme + Beta testing.");
    await userEvent.click(screen.getByRole("button", { name: "Send answer" }));

    expect(await screen.findByText("Acme + Beta testing.")).toBeInTheDocument();
    expect(screen.getByText("Legal settings")).toBeInTheDocument();
  });
});
