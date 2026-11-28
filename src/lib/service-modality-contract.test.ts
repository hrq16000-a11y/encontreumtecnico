import { describe, expect, it } from "vitest";
import { declaredServiceModalities, serviceModalityMatch } from "./service-modality-contract";

describe("declarações explícitas de modalidade", () => {
  it("não infere modalidade de transporte ou ferramentas", () => {
    expect(serviceModalityMatch({ can_travel: true }, "onsite")).toBe("unknown");
    expect(serviceModalityMatch([], "remote")).toBe("unknown");
  });
  it("normaliza apenas códigos permitidos sem duplicatas", () => {
    expect(declaredServiceModalities(["remote", "remote", "invalid", "bench"])).toEqual(["bench", "remote"]);
  });
  it("não presume que híbrido significa qualquer outra modalidade", () => {
    expect(serviceModalityMatch(["hybrid"], "remote")).toBe("not_declared");
    expect(serviceModalityMatch(["remote"], "remote")).toBe("declared");
  });
});
