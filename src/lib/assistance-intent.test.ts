import { describe, expect, it } from "vitest";
import { buildAssistanceLead } from "./assistance-intent";

const data = { name:"Ana Clienta",email:"ana@example.com",service:"CFTV",when:"Hoje / urgente",problem:"Câmera parou de gravar ontem",city:"Curitiba",uf:"PR",neighborhood:"Batel" };
describe("Funil comercial não concede contato pago",()=>{
  it("classifica solicitação gerenciada sem custo antecipado",()=>{
    const result=buildAssistanceLead({...data,mode:"managed"});
    expect(result?.subject).toContain("Gestão assistida sem antecipação");
    expect(result?.message).toContain("Curitiba");
    expect(result?.message).toContain("Batel");
    expect(JSON.stringify(result)).not.toMatch(/contact_entitlement|phone_e164|card_number/i);
  });
  it("interesse de compra não equivale a pagamento",()=>{
    const result=buildAssistanceLead({...data,mode:"direct"});
    expect(result?.subject).toContain("NÃO PAGO");
    expect(result?.message).toContain("nenhum pagamento efetuado");
  });
  it("bloqueia dados insuficientes",()=>{
    expect(buildAssistanceLead({...data,mode:"managed",problem:"curto"})).toBeNull();
    expect(buildAssistanceLead({...data,mode:"direct",email:"invalid"})).toBeNull();
  });
});
