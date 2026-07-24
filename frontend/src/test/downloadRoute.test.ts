import { afterEach, describe, expect, it, vi } from "vitest";
import type { MutualNdaFormData } from "@/lib/mutualNdaSchema";
import type { GenericDocumentDraft } from "@/lib/api";

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

const genericPayload: GenericDocumentDraft = {
  documentTitle: "Data Processing Agreement",
  effectiveDate: "2026-08-01",
  businessPurpose: "Processing customer records under GDPR.",
  governingLaw: "Ireland",
  keyTerms: "Processor acts only on documented instructions.",
  specialTerms: "",
  parties: [
    { role: "Controller", name: "Acme", title: "CEO", company: "Acme Ltd", email: "dpo@acme.test", address: "1 Dublin Rd" },
    { role: "Processor", name: "Beta", title: "CFO", company: "Beta Ltd", email: "ops@beta.test", address: "2 Cork Rd" },
  ],
};

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("POST /api/download", () => {
  it("returns a PDF attachment for a valid Mutual NDA payload", async () => {
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
      body: JSON.stringify({ documentKey: "mutual-nda", draft: basePayload }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("mutual-nda.pdf");

    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(bytes.toString("utf8")).toContain("%PDF-mocked-output");
  });

  it("returns a PDF attachment for a valid generic document payload", async () => {
    vi.doMock("@/lib/pdf", () => ({
      createMutualNdaPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-generic-output", "utf8")),
    }));

    const { POST } = await import("@/app/api/download/route");
    const response = await POST(new Request("http://localhost/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentKey: "data-processing-agreement", draft: genericPayload }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("data-processing-agreement.pdf");
  });

  it("returns 400 field errors for invalid payloads", async () => {
    const { POST } = await import("@/app/api/download/route");
    const response = await POST(new Request("http://localhost/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentKey: "mutual-nda", draft: { ...basePayload, partyOne: { ...basePayload.partyOne, printName: " " } } }),
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("application/json");

    const payload = await response.json();
    expect(payload.error).toBe("Invalid document fields");
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
      body: JSON.stringify({ documentKey: "mutual-nda", draft: basePayload }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to generate PDF" });
  });
});