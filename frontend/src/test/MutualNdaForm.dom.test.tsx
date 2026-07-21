import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MutualNdaForm } from "@/components/MutualNdaForm";

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Print name", { selector: "input[id='partyOne-printName']" }), { target: { value: "Pat One" } });
  fireEvent.change(screen.getByLabelText("Title", { selector: "input[id='partyOne-title']" }), { target: { value: "CEO" } });
  fireEvent.change(screen.getByLabelText("Company", { selector: "input[id='partyOne-company']" }), { target: { value: "Acme" } });
  fireEvent.change(screen.getByLabelText("Notice address", { selector: "textarea[id='partyOne-noticeAddress']" }), { target: { value: "100 Main St" } });
  fireEvent.change(screen.getByLabelText("Signature date", { selector: "input[id='partyOne-signatureDate']" }), { target: { value: "2026-08-01" } });

  fireEvent.change(screen.getByLabelText("Print name", { selector: "input[id='partyTwo-printName']" }), { target: { value: "Sam Two" } });
  fireEvent.change(screen.getByLabelText("Title", { selector: "input[id='partyTwo-title']" }), { target: { value: "CFO" } });
  fireEvent.change(screen.getByLabelText("Company", { selector: "input[id='partyTwo-company']" }), { target: { value: "Beta" } });
  fireEvent.change(screen.getByLabelText("Notice address", { selector: "textarea[id='partyTwo-noticeAddress']" }), { target: { value: "200 Oak Ave" } });
  fireEvent.change(screen.getByLabelText("Signature date", { selector: "input[id='partyTwo-signatureDate']" }), { target: { value: "2026-08-02" } });
}

describe("MutualNdaForm", () => {
  const fetchMock = vi.fn();
  const createObjectURLMock = vi.fn(() => "blob:mock-url");
  const revokeObjectURLMock = vi.fn();
  const clickMock = vi.fn();
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);

      if (tagName === "a") {
        Object.defineProperty(element, "click", {
          value: clickMock,
          configurable: true,
        });
      }

      return element;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    clickMock.mockClear();
  });

  it("populates blank dates after mount when initialDate is empty", async () => {
    render(<MutualNdaForm initialDate="" />);

    await waitFor(() => {
      expect((screen.getByLabelText("Effective date") as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("shows inline validation errors and does not call fetch when required fields are missing", async () => {
    render(<MutualNdaForm initialDate="2026-08-01" />);

    await userEvent.click(screen.getByRole("button", { name: "Download Mutual NDA PDF" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Print name is required|Title is required|Company is required|Notice address is required|Signature date is required/).length).toBeGreaterThan(0);
  });

  it("submits valid data, disables the button while generating, and triggers a browser download", async () => {
    let resolveFetch: ((value: { ok: true; blob: () => Promise<Blob> }) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(<MutualNdaForm initialDate="2026-08-01" />);
    fillRequiredFields();

    const button = screen.getByRole("button", { name: "Download Mutual NDA PDF" });
    await userEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/download", expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }));
    });

    expect(screen.getByRole("button", { name: "Generating PDF..." })).toBeDisabled();

    resolveFetch?.({
      ok: true,
      blob: () => Promise.resolve(new Blob(["%PDF-test"], { type: "application/pdf" })),
    });

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");
    });
    expect(await screen.findByText("PDF generated successfully.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Mutual NDA PDF" })).not.toBeDisabled();
  });

  it("surfaces server-side field errors returned by the API", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        error: "Invalid NDA fields",
        fieldErrors: {
          "partyOne.company": "Server says party one company is invalid",
        },
      }),
    });

    render(<MutualNdaForm initialDate="2026-08-01" />);
    fillRequiredFields();

    await userEvent.click(screen.getByRole("button", { name: "Download Mutual NDA PDF" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Server says party one company is invalid")).toBeInTheDocument();
  });

  it("shows an error message when the network request fails", async () => {
    fetchMock.mockRejectedValue(new Error("Network down"));

    render(<MutualNdaForm initialDate="2026-08-01" />);
    fillRequiredFields();

    await userEvent.click(screen.getByRole("button", { name: "Download Mutual NDA PDF" }));

    expect(await screen.findByText("Network down")).toBeInTheDocument();
  });

  it("does not trigger download when pressing Enter in a text field", async () => {
    render(<MutualNdaForm initialDate="2026-08-01" />);

    await userEvent.type(screen.getByLabelText("Governing law"), "{enter}");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
