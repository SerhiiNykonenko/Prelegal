import { z } from "zod";

import { createDefaultMutualNdaValues, mutualNdaSchema } from "@/lib/mutualNdaSchema";
import type { DocumentKey, GenericDocumentDraft } from "@/lib/api";

const genericPartySchema = z.object({
  role: z.string().trim().min(1, "Role is required"),
  name: z.string().trim().min(1, "Name is required"),
  title: z.string().trim().default(""),
  company: z.string().trim().min(1, "Company is required"),
  email: z.string().trim().default(""),
  address: z.string().trim().default(""),
});

export const genericDocumentSchema = z.object({
  documentTitle: z.string().trim().min(1, "Document title is required"),
  effectiveDate: z.string().trim().min(1, "Effective date is required"),
  businessPurpose: z.string().trim().min(1, "Business purpose is required"),
  governingLaw: z.string().trim().min(1, "Governing law is required"),
  keyTerms: z.string().trim().min(1, "Key terms are required"),
  specialTerms: z.string().trim().default(""),
  parties: z.array(genericPartySchema).min(2, "At least two parties are required"),
});

export type GenericDocumentFormData = z.infer<typeof genericDocumentSchema>;
export type GenericDocumentFieldErrors = Partial<Record<string, string>>;

function createDefaultGenericValues(documentTitle: string, date: Date | string = new Date()): GenericDocumentDraft {
  const today = typeof date === "string" ? date : date.toISOString().slice(0, 10);

  return {
    documentTitle,
    effectiveDate: today,
    businessPurpose: "",
    governingLaw: "",
    keyTerms: "",
    specialTerms: "",
    parties: [
      { role: "Party 1", name: "", title: "", company: "", email: "", address: "" },
      { role: "Party 2", name: "", title: "", company: "", email: "", address: "" },
    ],
  };
}

export function flattenGenericZodErrors(error: z.ZodError): GenericDocumentFieldErrors {
  return Object.fromEntries(error.issues.map((issue) => [issue.path.join("."), issue.message]));
}

type DocumentDefinition<TDraft> = {
  title: string;
  description: string;
  templateFilename: string;
  createDefaultValues: (date?: Date | string) => TDraft;
  schema: z.ZodType<TDraft>;
  reviewSections: string[];
};

export const documentRegistry: Record<DocumentKey, DocumentDefinition<any>> = {
  "mutual-nda": {
    title: "Mutual NDA",
    description: "Common Paper standard Mutual Non-Disclosure Agreement.",
    templateFilename: "Mutual-NDA.md",
    createDefaultValues: createDefaultMutualNdaValues,
    schema: mutualNdaSchema,
    reviewSections: ["Agreement details", "Terms", "Party 1", "Party 2"],
  },
  "cloud-service-agreement": {
    title: "Cloud Service Agreement",
    description: "Common Paper standard Cloud Service Agreement.",
    templateFilename: "CSA.md",
    createDefaultValues: (date) => createDefaultGenericValues("Cloud Service Agreement", date),
    schema: genericDocumentSchema,
    reviewSections: ["Agreement details", "Parties", "Key terms", "Special terms"],
  },
  "service-level-agreement": {
    title: "Service Level Agreement",
    description: "Common Paper Service Level Agreement.",
    templateFilename: "sla.md",
    createDefaultValues: (date) => createDefaultGenericValues("Service Level Agreement", date),
    schema: genericDocumentSchema,
    reviewSections: ["Agreement details", "Parties", "Key terms", "Special terms"],
  },
  "professional-services-agreement": {
    title: "Professional Services Agreement",
    description: "Common Paper standard Professional Services Agreement.",
    templateFilename: "psa.md",
    createDefaultValues: (date) => createDefaultGenericValues("Professional Services Agreement", date),
    schema: genericDocumentSchema,
    reviewSections: ["Agreement details", "Parties", "Key terms", "Special terms"],
  },
  "data-processing-agreement": {
    title: "Data Processing Agreement",
    description: "Common Paper standard Data Processing Agreement.",
    templateFilename: "DPA.md",
    createDefaultValues: (date) => createDefaultGenericValues("Data Processing Agreement", date),
    schema: genericDocumentSchema,
    reviewSections: ["Agreement details", "Parties", "Key terms", "Special terms"],
  },
  "design-partner-agreement": {
    title: "Design Partner Agreement",
    description: "Common Paper standard Design Partner Agreement.",
    templateFilename: "design-partner-agreement.md",
    createDefaultValues: (date) => createDefaultGenericValues("Design Partner Agreement", date),
    schema: genericDocumentSchema,
    reviewSections: ["Agreement details", "Parties", "Key terms", "Special terms"],
  },
  "ai-addendum": {
    title: "AI Addendum",
    description: "Common Paper Standard AI Addendum.",
    templateFilename: "AI-Addendum.md",
    createDefaultValues: (date) => createDefaultGenericValues("AI Addendum", date),
    schema: genericDocumentSchema,
    reviewSections: ["Agreement details", "Parties", "Key terms", "Special terms"],
  },
  "pilot-agreement": {
    title: "Pilot Agreement",
    description: "Common Paper standard Pilot Agreement.",
    templateFilename: "Pilot-Agreement.md",
    createDefaultValues: (date) => createDefaultGenericValues("Pilot Agreement", date),
    schema: genericDocumentSchema,
    reviewSections: ["Agreement details", "Parties", "Key terms", "Special terms"],
  },
  "software-license-agreement": {
    title: "Software License Agreement",
    description: "Common Paper standard Software License Agreement.",
    templateFilename: "Software-License-Agreement.md",
    createDefaultValues: (date) => createDefaultGenericValues("Software License Agreement", date),
    schema: genericDocumentSchema,
    reviewSections: ["Agreement details", "Parties", "Key terms", "Special terms"],
  },
  "partnership-agreement": {
    title: "Partnership Agreement",
    description: "Common Paper standard Partnership Agreement.",
    templateFilename: "Partnership-Agreement.md",
    createDefaultValues: (date) => createDefaultGenericValues("Partnership Agreement", date),
    schema: genericDocumentSchema,
    reviewSections: ["Agreement details", "Parties", "Key terms", "Special terms"],
  },
  "business-associate-agreement": {
    title: "Business Associate Agreement",
    description: "Common Paper standard Business Associate Agreement.",
    templateFilename: "BAA.md",
    createDefaultValues: (date) => createDefaultGenericValues("Business Associate Agreement", date),
    schema: genericDocumentSchema,
    reviewSections: ["Agreement details", "Parties", "Key terms", "Special terms"],
  },
};

export const documentEntries = Object.entries(documentRegistry) as [DocumentKey, (typeof documentRegistry)[DocumentKey]][];
