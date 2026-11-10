import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CATALOG_CATEGORIES, categorySlug, extractDeclaredLocation, triageLocally,
} from "./problem-triage-local";

export type TriageResult =
  | { ok: true; category: string; reason: string; city: string; region: string; keywords: string[] }
  | { ok: false; error: string };

// The free, deterministic classifier is always available. Optional AI refinement
// must never be a prerequisite for using the directory or consume gateway credits
// when the service has no configured key.
export const triageProblem = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ description: z.string().trim().min(10).max(1000) }).parse(data))
  .handler(async ({ data }): Promise<TriageResult> => {
    const fallback = triageLocally(data.description);
    if (!process.env["LOVABLE_API_KEY"]) return fallback;

    try {
      const { generateResponse } = await import("@lovable.dev/ai-gateway");
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        instructions:
          "Classifique o problema técnico descrito pelo cliente. Responda com um slug exatamente da lista fornecida; se incerto, use 'Todas'. Não invente cidade, bairro, contato ou GPS. Limite a justificativa a uma frase.",
        input: [{ role: "user", content: data.description }],
        text: {
          format: {
            type: "json_schema",
            name: "triage",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["category", "reason", "city", "region", "keywords"],
              properties: {
                category: { type: "string", enum: [...CATALOG_CATEGORIES, "Todas"] },
                reason: { type: "string" },
                city: { type: "string" },
                region: { type: "string" },
                keywords: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      });
      let output = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") {
          for (const part of item.content) {
            if (part.type === "output_text") output += part.text;
          }
        }
      }
      const parsed = JSON.parse(output) as Record<string, unknown>;
      const category = parsed.category === "Todas" ? "Todas" : categorySlug(parsed.category);
      if (!category) return fallback;
      // Never trust model-generated geography; only explicit statements may
      // populate location filters. The local extractor enforces this rule.
      const declared = extractDeclaredLocation(data.description);
      return {
        ok: true,
        category,
        reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 180) : fallback.reason,
        city: declared.city,
        region: declared.region,
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords.filter((k): k is string => typeof k === "string").slice(0, 4).map((k) => k.slice(0, 40))
          : fallback.keywords,
      };
    } catch (error) {
      // Gateway outage, invalid model response and quota errors must not break
      // the core search experience. Do not leak request text into logs.
      console.warn("Triage gateway unavailable; local classifier used", error instanceof Error ? error.name : "unknown");
      return fallback;
    }
  });
