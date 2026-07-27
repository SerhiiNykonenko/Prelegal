import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createMutualNdaPdf } from "@/lib/pdf";
import { flattenZodErrors, mutualNdaSchema } from "@/lib/mutualNdaSchema";
import { renderMutualNdaMarkdown } from "@/lib/renderMutualNda";
import { loadMutualNdaTemplates } from "@/lib/templates";
import type { DocumentKey } from "@/lib/api";
import { genericDocumentSchema } from "@/lib/documentRegistry";

export const runtime = "nodejs";

const requestSchema = z.object({
  documentKey: z.string(),
  draft: z.unknown(),
});

async function loadGenericTemplate(templateFilename: string): Promise<string | null> {
  const candidate = path.join(process.cwd(), "src", "data", "templates", templateFilename);
  try {
    return await readFile(candidate, "utf-8");
  } catch {
    return null;
  }
}

function buildGenericMarkdown(draft: z.infer<typeof genericDocumentSchema>): string {
  const lines: string[] = [];
  lines.push(`# ${draft.documentTitle}`);
  lines.push("");
  lines.push(`Effective date: ${draft.effectiveDate}`);
  lines.push("");
  lines.push("## Business purpose");
  lines.push(draft.businessPurpose);
  lines.push("");
  lines.push("## Parties");
  for (const party of draft.parties) {
    const label = party.role || party.name || party.company || "Party";
    lines.push(`- **${label}**: ${party.name || "—"} (${party.company || "—"})${party.email ? ` <${party.email}>` : ""}`);
    if (party.address) {
      lines.push(`  - Address: ${party.address}`);
    }
  }
  lines.push("");
  lines.push("## Key terms");
  lines.push(draft.keyTerms);
  lines.push("");
  if (draft.specialTerms) {
    lines.push("## Special terms");
    lines.push(draft.specialTerms);
    lines.push("");
  }
  lines.push(`Governing law: ${draft.governingLaw}`);
  return lines.join("\n");
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsedRequest = requestSchema.parse(payload);
    const documentKey = parsedRequest.documentKey as DocumentKey;

    if (documentKey === "mutual-nda") {
      const data = mutualNdaSchema.parse(parsedRequest.draft);
      const templates = await loadMutualNdaTemplates();
      const markdown = renderMutualNdaMarkdown(data, templates);
      const pdf = await createMutualNdaPdf(markdown);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Disposition": 'attachment; filename="mutual-nda.pdf"',
          "Content-Type": "application/pdf",
        },
      });
    }

    const draft = genericDocumentSchema.parse(parsedRequest.draft);
    const templateFilename = await import("@/lib/documentRegistry").then((module) => module.documentRegistry[documentKey].templateFilename);
    const templateBody = await loadGenericTemplate(templateFilename);
    const generatedMarkdown = buildGenericMarkdown(draft);
    const combinedMarkdown = templateBody
      ? `${generatedMarkdown}\n\n---\n\n# Template reference\n\n${templateBody}`
      : generatedMarkdown;
    const pdf = await createMutualNdaPdf(combinedMarkdown);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Disposition": `attachment; filename="${documentKey}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid document fields", fieldErrors: flattenZodErrors(error) },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Unable to generate PDF" }, { status: 500 });
  }
}
