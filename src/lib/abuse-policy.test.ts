import { describe, it, expect } from "vitest";
import { ABUSE_POLICY, decideVerifiedAction, missingPhase3Evidence, parseAbuseSnapshot } from "./abuse-policy";
describe("Fase 4 — rate limit progressivo por operação, nunca por IP", () => {
  const base={accountVerified:true,failures15m:0,failures7d:0,priorHolds7d:0,blockedUntil:null};
  it("operações legítimas não são penalizadas e um login desconhecido não ganha acesso",()=>{
    expect(decideVerifiedAction(base).kind).toBe("allow");
    expect(decideVerifiedAction({...base,failures15m:4,failures7d:4}).kind).toBe("allow");
    expect(decideVerifiedAction({...base,accountVerified:false}).kind).toBe("unverified");
  });
  it("avisa aos cinco erros verificados e escala conforme reincidência comprovada",()=>{
    expect(ABUSE_POLICY.warnAt).toBe(5);
    expect(decideVerifiedAction({...base,failures15m:5,failures7d:5}).kind).toBe("warn");
    expect(decideVerifiedAction({...base,failures15m:5,failures7d:10})).toEqual({
      kind:"cooldown",allowed:false,retryAfterSeconds:7200,
    });
    expect(decideVerifiedAction({...base,failures15m:5,failures7d:13}).retryAfterSeconds).toBe(18000);
    expect(decideVerifiedAction({...base,failures15m:5,failures7d:14,priorHolds7d:2}).retryAfterSeconds).toBe(86400);
  });
  it("respeita expiração e nunca aumenta bloqueio por sinal de IP, VPN ou ISP",()=>{
    expect(decideVerifiedAction({...base,blockedUntil:"2026-11-22T02:10:00.000Z"},new Date("2026-11-22T02:00:00Z")))
      .toEqual({kind:"cooldown",allowed:false,retryAfterSeconds:600});
    expect(decideVerifiedAction({...base,blockedUntil:"2026-11-22T01:00:00.000Z"},new Date("2026-11-22T02:00:00Z")).kind).toBe("allow");
    expect(Object.keys(base)).not.toContain("ip");
    expect(Object.keys(base)).not.toContain("vpn");
    expect(Object.keys(base)).not.toContain("operator");
  });
  it("snapshot de RPC rejeita dados e identidade arbitrários",()=>{
    expect(parseAbuseSnapshot({ok:true,rows:[],audit:[],total:0,page:0})).not.toBeNull();
    expect(parseAbuseSnapshot({ok:false,rows:[],audit:[],total:0,page:0})).toBeNull();
    expect(parseAbuseSnapshot({ok:true,rows:[{actor_id:"someone@site.test"}],audit:[],total:1,page:0})).toBeNull();
    expect(parseAbuseSnapshot({ok:true,rows:[],audit:[],total:"0",page:0})).toBeNull();
  });
  it("camadas A/B/C continuam NO-GO mesmo se uma única prova estiver ausente",()=>{
    expect(missingPhase3Evidence(null)).toHaveLength(9);
    const all=Object.fromEntries(missingPhase3Evidence(null).map(x=>[x,true]));
    expect(missingPhase3Evidence({...all,officialActionsGuarded:false})).toEqual(["officialActionsGuarded"]);
    expect(missingPhase3Evidence(all)).toEqual([]); // operador ainda decide ativação
  });
});
