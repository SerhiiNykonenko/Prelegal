import { afterEach, describe, expect, it, vi } from "vitest";
import type { MutualNdaFormData } from "@/lib/mutualNdaSchema";

const basePayload: MutualNdaFormData = {
  purpose: "Evaluate a partnership.",
  effectiveDate: "2026-08-01",
  mndaTermType: "fixed",
  mndaTermYears: 1,
  confidentialityTermType: "fixed",
  confidentialityTermYears: 1,
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "None.",
  partyOne: {
    printName: "Pat One",
    title: "CEO",
    company: "Acme",
    noticeAddress: "100 Main St",
    signatureDate: "2026-08-01",
  },
  partyTwo: {
    printName: "Sam Two",
    title: "CFO",
    company: "Beta",
    noticeAddress: "200 Oak Ave",
    signatureDate: "2026-08-02",
  },
};

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("POST /api/download", () => {
  it("returns a PDF attachment for a valid payload", async () => {
    vi.doMock("@/lib/templates", () => ({
      loadMutualNdaTemplates: vi.fn().mockResolvedValue({
        coverPage: "# Cover\n{{purpose}}\n{{partyOnePrintName}}\n{{partyTwoPrintName}}",
        standardTerms: "# Terms\nSigned on {{effectiveDate}}.",
      }),
    }));
    vi.doMock("@/lib/pdf", () => ({
      createMutualNdaPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-mocked-output", "utf8")),
    }));

    const { POST } = await import("@/app/api/download/route");
    const response = await POST(new Request("http://localhost/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("mutual-nda.pdf");

    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(bytes.toString("utf8")).toContain("%PDF-mocked-output");
  });

  it("returns 400 field errors for invalid payloads", async () => {
    const { POST } = await import("@/app/api/download/route");
    const response = await POST(new Request("http://localhost/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...basePayload, partyOne: { ...basePayload.partyOne, printName: " " } }),
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("application/json");

    const payload = await response.json();
    expect(payload.error).toBe("Invalid NDA fields");
    expect(payload.fieldErrors["partyOne.printName"]).toBeTruthy();
  });

  it("returns 500 when PDF generation fails", async () => {
    vi.doMock("@/lib/pdf", () => ({
      createMutualNdaPdf: vi.fn().mockRejectedValue(new Error("boom")),
    }));
    vi.doMock("@/lib/templates", () => ({
      loadMutualNdaTemplates: vi.fn().mockResolvedValue({
        coverPage: "# Cover\n{{purpose}}",
        standardTerms: "# Terms\n{{effectiveDate}}",
      }),
    }));

    const { POST } = await import("@/app/api/download/route");
    const response = await POST(new Request("http://localhost/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to generate PDF" });
  });
});
