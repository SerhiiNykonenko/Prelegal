import { createDefaultMutualNdaValues, mutualNdaSchema } from "@/lib/mutualNdaSchema";

export const documentRegistry = {
  "mutual-nda": {
    title: "Mutual NDA",
    createDefaultValues: createDefaultMutualNdaValues,
    schema: mutualNdaSchema,
    reviewSections: [
      "Agreement details",
      "Terms",
      "Party 1",
      "Party 2",
    ],
  },
} as const;
