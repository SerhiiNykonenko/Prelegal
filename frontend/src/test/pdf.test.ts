import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createMutualNdaPdf } from "@/lib/pdf";
import { createDefaultMutualNdaValues } from "@/lib/mutualNdaSchema";
import { renderMutualNdaMarkdown } from "@/lib/renderMutualNda";
import { loadMutualNdaTemplates } from "@/lib/templates";

const sampleMarkdown = `# Mutual Non-Disclosure Agreement

## Purpose
Evaluation of a potential business relationship.

## MNDA Term
- [x] Expires 2 years from Effective Date.
- [ ] Continues until terminated in accordance with the terms of the MNDA.

## Parties
| Field | Party 1 | Party 2 |
|:--- | :----: | :----: |
| Print Name | Pat One | Sam Two |
| Company | Acme | Beta |

# Standard Terms

1. **Introduction**. This MNDA governs confidential information shared between the parties.
`;

const defaultValues = createDefaultMutualNdaValues("2026-07-21");

const realisticData = {
  ...defaultValues,
  purpose: "Evaluate a possible strategic partnership and exchange implementation details.",
  effectiveDate: "2026-08-01",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "No reverse engineering of prototypes.",
  partyOne: {
    ...defaultValues.partyOne,
    printName: "Pat One",
    title: "CEO",
    company: "Acme",
    noticeAddress: "100 Main St, Wilmington, DE",
    signatureDate: "2026-08-01",
  },
  partyTwo: {
    ...defaultValues.partyTwo,
    printName: "Sam Two",
    title: "CFO",
    company: "Beta",
    noticeAddress: "200 Oak Ave, San Francisco, CA",
    signatureDate: "2026-08-02",
  },
};

type ParsedPage = {
  text: string;
  lines: string[];
  footerText: string | null;
  footerY: number | null;
};

async function parsePdf(buffer: Buffer) {
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pages: ParsedPage[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const items = content.items.filter((item): item is { str: string; transform: number[] } => "str" in item && typeof item.str === "string");
    const lines = items.map((item) => item.str.trim()).filter(Boolean);
    const footer = items.find((item) => /Mutual NDA · Page \d+/.test(item.str));

    pages.push({
      text: lines.join("\n"),
      lines,
      footerText: footer?.str ?? null,
      footerY: footer?.transform?.[5] ?? null,
    });
  }

  return { numPages: pdf.numPages, pages };
}

async function buildRealTemplatePdf() {
  const templates = await loadMutualNdaTemplates();
  const markdown = renderMutualNdaMarkdown(realisticData, templates);
  return createMutualNdaPdf(markdown);
}

describe("createMutualNdaPdf", () => {
  it("returns a non-empty PDF buffer", async () => {
    const pdf = await createMutualNdaPdf(sampleMarkdown);

    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("renders expected content from inline markdown", async () => {
    const pdf = await createMutualNdaPdf(sampleMarkdown);
    const parsed = await parsePdf(pdf);
    const combinedText = parsed.pages.map((page) => page.text).join("\n");

    expect(parsed.numPages).toBeGreaterThanOrEqual(1);
    expect(combinedText).toContain("Mutual Non-Disclosure Agreement");
    expect(combinedText).toContain("Purpose");
    expect(combinedText).toContain("Pat One");
    expect(combinedText).toContain("Sam Two");
    expect(combinedText).toContain("Standard Terms");
  });

  it("renders real templates without unresolved tokens", async () => {
    const pdf = await buildRealTemplatePdf();
    const parsed = await parsePdf(pdf);
    const combinedText = parsed.pages.map((page) => page.text).join("\n");

    expect(combinedText).toContain(realisticData.purpose);
    expect(combinedText).toContain(realisticData.effectiveDate);
    expect(combinedText).toContain(realisticData.governingLaw);
    expect(combinedText).toContain(realisticData.jurisdiction);
    expect(combinedText).toContain(realisticData.partyOne.printName);
    expect(combinedText).toContain(realisticData.partyTwo.printName);
    expect(combinedText).toContain(realisticData.partyOne.company);
    expect(combinedText).toContain(realisticData.partyTwo.company);
    expect(combinedText).not.toContain("{{");
    expect(combinedText).not.toContain("}}");
  });

  it("includes footer numbering on every page and avoids footer-only blank pages", async () => {
    const pdf = await buildRealTemplatePdf();
    const parsed = await parsePdf(pdf);

    expect(parsed.numPages).toBeGreaterThan(1);

    parsed.pages.forEach((page, index) => {
      expect(page.footerText).toBe(`Mutual NDA · Page ${index + 1}`);

      const nonFooterText = page.lines
        .filter((line) => !/^Mutual NDA · Page \d+$/.test(line))
        .join(" ")
        .trim();

      expect(nonFooterText.length).toBeGreaterThan(20);
    });
  });

  it("keeps footer text in the bottom band of each page", async () => {
    const pdf = await buildRealTemplatePdf();
    const parsed = await parsePdf(pdf);

    parsed.pages.forEach((page) => {
      expect(page.footerY).not.toBeNull();
      expect(page.footerY as number).toBeGreaterThan(40);
      expect(page.footerY as number).toBeLessThan(90);
    });
  });

  it("adds pages for long content without introducing blank trailing pages", async () => {
    const longMarkdown = `${sampleMarkdown}\n${Array.from({ length: 120 }, (_, index) => `${index + 2}. **Clause ${index + 2}**. This is a long paragraph intended to exercise pagination and footer placement without creating blank pages.`).join("\n\n")}`;
    const pdf = await createMutualNdaPdf(longMarkdown);
    const parsed = await parsePdf(pdf);

    expect(parsed.numPages).toBeGreaterThan(2);

    parsed.pages.forEach((page, index) => {
      expect(page.footerText).toBe(`Mutual NDA · Page ${index + 1}`);

      const nonFooterText = page.lines
        .filter((line) => !/^Mutual NDA · Page \d+$/.test(line))
        .join(" ")
        .trim();

      expect(nonFooterText.length).toBeGreaterThan(20);
    });
  });
});
