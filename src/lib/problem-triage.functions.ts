import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CATEGORIES } from "./categories";

export type TriageResult =
  | { ok: true; category: string; reason: string; city: string; region: string; keywords: string[] }
  | { ok: false; error: string };

export const triageProblem = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ description: z.string().trim().min(10).max(1000) }).parse(data))
  .handler(async ({ data }): Promise<TriageResult> => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        instructions:
          "Você classifica problemas técnicos descritos por clientes brasileiros. Escolha a categoria de serviço mais adequada da lista. Extraia cidade e região/bairro somente se citados; caso contrário, string vazia. Sugira até 4 palavras-chave curtas de busca. Explique o motivo em uma frase curta em português.",
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
                category: { type: "string", enum: [...CATEGORIES] },
                reason: { type: "string" },
                city: { type: "string" },
                region: { type: "string" },
                keywords: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      });
      let text = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") {
          for (const c of item.content) if (c.type === "output_text") text += c.text;
        }
      }
      const parsed = JSON.parse(text);
      return { ok: true, ...parsed, keywords: (parsed.keywords ?? []).slice(0, 4) };
    } catch (err) {
      console.error("triageProblem failed", err);
      if (err instanceof GatewayError && err.httpStatus === 429)
        return { ok: false, error: "Muitas solicitações no momento. Tente novamente em instantes." };
      if (err instanceof GatewayError && err.httpStatus === 402)
        return { ok: false, error: "O assistente está temporariamente indisponível." };
      return { ok: false, error: "Não foi possível analisar o problema agora. Tente novamente." };
    }
  });
