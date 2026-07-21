import { NextResponse } from "next/server";
import { z } from "zod";
import { createMutualNdaPdf } from "@/lib/pdf";
import { flattenZodErrors, mutualNdaSchema } from "@/lib/mutualNdaSchema";
import { renderMutualNdaMarkdown } from "@/lib/renderMutualNda";
import { loadMutualNdaTemplates } from "@/lib/templates";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = mutualNdaSchema.parse(payload);
    const templates = await loadMutualNdaTemplates();
    const markdown = renderMutualNdaMarkdown(data, templates);
    const pdf = await createMutualNdaPdf(markdown);

    return new NextResponse(pdf, {
      headers: {
        "Content-Disposition": 'attachment; filename="mutual-nda.pdf"',
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid NDA fields", fieldErrors: flattenZodErrors(error) },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Unable to generate PDF" }, { status: 500 });
  }
}
