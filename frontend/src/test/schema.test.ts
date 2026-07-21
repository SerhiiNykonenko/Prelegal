import { describe, expect, it } from "vitest";
import {
  createDefaultMutualNdaValues,
  flattenZodErrors,
  mutualNdaSchema,
} from "@/lib/mutualNdaSchema";

const defaultMutualNdaValues = createDefaultMutualNdaValues(new Date("2026-07-21T00:00:00.000Z"));

const validParties = {
  partyOne: {
    ...defaultMutualNdaValues.partyOne,
    printName: "Pat",
    title: "Engineer",
    company: "Acme",
    noticeAddress: "pat@acme.test",
    signatureDate: "2026-07-21",
  },
  partyTwo: {
    ...defaultMutualNdaValues.partyTwo,
    printName: "Sam",
    title: "Director",
    company: "Beta",
    noticeAddress: "sam@beta.test",
    signatureDate: "2026-07-21",
  },
};

describe("mutualNdaSchema", () => {
  it("accepts the default values with completed parties", () => {
    const result = mutualNdaSchema.safeParse({
      ...defaultMutualNdaValues,
      ...validParties,
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing purpose", () => {
    const result = mutualNdaSchema.safeParse({
      ...defaultMutualNdaValues,
      ...validParties,
      purpose: " ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = flattenZodErrors(result.error);
      expect(errors["purpose"]).toBeTruthy();
    }
  });

  it("rejects out of range term years", () => {
    const result = mutualNdaSchema.safeParse({
      ...defaultMutualNdaValues,
      ...validParties,
      mndaTermYears: 30,
    });

    expect(result.success).toBe(false);
  });
});
