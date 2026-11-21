import { describe, it, expect } from "vitest";
import type { Municipality } from "@/hooks/use-municipalities";
import { findOfficialHint, verifiedCepFor, type LocationFieldValue } from "./location-field-validation";
const curitiba = {id:4106902,name:"Curitiba",uf:"PR",latitude:0,longitude:0} as Municipality;
const sjp = {id:4125506,name:"São José dos Pinhais",uf:"PR",latitude:0,longitude:0} as Municipality;
const selected: LocationFieldValue = {uf:"PR",city:"Curitiba",municipalityIbgeId:4106902,neighborhood:"",postalCode:""};
describe("LocationField — localidade oficial e CEP verificável", () => {
  it("IP não confirma município inexistente ou ambíguo", () => {
    expect(findOfficialHint([curitiba,sjp],"CURITIBA","PR")?.id).toBe(4106902);
    expect(findOfficialHint([curitiba,sjp],"Curitiba","SP")).toBeNull();
    expect(findOfficialHint([curitiba,sjp],"Cidade inventada","PR")).toBeNull();
    expect(findOfficialHint([curitiba,curitiba],"Curitiba","PR")).toBeNull();
  });
  it("CEP valida localidade e não aceita divergência de UF/IBGE", () => {
    const response = {cep:"80010-000",ibge:"4106902",uf:"PR",localidade:"Curitiba",bairro:"Centro"};
    expect(verifiedCepFor(selected,"80010000",response)).toEqual({cep:"80010000",neighborhood:"Centro"});
    expect(verifiedCepFor(selected,"80010001",response)).toBeNull();
    expect(verifiedCepFor(selected,"80010000",{...response,ibge:"4125506"})).toBeNull();
    expect(verifiedCepFor(selected,"80010000",{...response,uf:"SP"})).toBeNull();
    expect(verifiedCepFor({...selected,municipalityIbgeId:null},"80010000",response)).toBeNull();
    expect(verifiedCepFor(selected,"80010000",{...response,erro:true})).toBeNull();
  });
  it("bairro ausente não é inventado", () => {
    expect(verifiedCepFor(selected,"80010000",
      {cep:"80010000",ibge:"4106902",uf:"PR",localidade:"Curitiba"}))
      .toEqual({cep:"80010000",neighborhood:""});
  });
});
