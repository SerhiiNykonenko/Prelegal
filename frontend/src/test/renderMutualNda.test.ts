import { describe, expect, it } from "vitest";
import { createDefaultMutualNdaValues } from "@/lib/mutualNdaSchema";
import { buildMutualNdaTokens, renderMutualNdaMarkdown, renderTemplate } from "@/lib/renderMutualNda";

const defaultMutualNdaValues = createDefaultMutualNdaValues(new Date("2026-07-21T00:00:00.000Z"));

const minimalData = {
  ...defaultMutualNdaValues,
  purpose: "Pilot evaluation",
  effectiveDate: "2026-08-01",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  partyOne: {
    ...defaultMutualNdaValues.partyOne,
    printName: "Pat One",
    title: "CEO",
    company: "Acme",
    noticeAddress: "pat@acme.test",
    signatureDate: "2026-08-01",
  },
  partyTwo: {
    ...defaultMutualNdaValues.partyTwo,
    printName: "Sam Two",
    title: "CFO",
    company: "Beta",
    noticeAddress: "sam@beta.test",
    signatureDate: "2026-08-02",
  },
};

const templates = {
  coverPage: `# Cover\n{{purpose}}\n{{mndaTerm}}\n{{confidentialityTerm}}\nPrint 1: {{partyOnePrintName}}\nPrint 2: {{partyTwoPrintName}}\nParty 1: {{partyOneCompany}}\nParty 2: {{partyTwoCompany}}\n`,
  standardTerms: `# Terms\nThe MNDA starts on {{effectiveDate}} under {{governingLaw}} in {{jurisdiction}}.\n`,
};

describe("renderTemplate", () => {
  it("substitutes known tokens", () => {
    const output = renderTemplate("Hello {{name}}", { name: "world" });
    expect(output).toBe("Hello world");
  });

  it("throws when a token is missing", () => {
    expect(() => renderTemplate("Hello {{name}}", {})).toThrow();
  });
});

describe("buildMutualNdaTokens", () => {
  it("marks the chosen MNDA term in the rendered value", () => {
    const tokens = buildMutualNdaTokens({ ...minimalData, mndaTermType: "until-terminated" as const });
    expect(tokens["mndaTerm"]).toContain("[x]");
    expect(tokens["mndaTerm"]).toContain("Continues until terminated");
  });

  it("marks the chosen confidentiality term in the rendered value", () => {
    const tokens = buildMutualNdaTokens({ ...minimalData, confidentialityTermType: "perpetual" as const });
    expect(tokens["confidentialityTerm"]).toContain("In perpetuity");
  });
});

describe("renderMutualNdaMarkdown", () => {
  it("produces a document with no unresolved tokens", () => {
    const output = renderMutualNdaMarkdown(minimalData, templates);
    expect(output).not.toMatch(/{{[a-zA-Z0-9]+}}/);
    expect(output).toContain("Pat One");
    expect(output).toContain("Sam Two");
    expect(output).toContain("# Terms");
  });

  it("preserves the standard terms heading", () => {
    const output = renderMutualNdaMarkdown(minimalData, templates);
    expect(output).toContain("# Cover");
    expect(output).toContain("# Terms");
  });
});
