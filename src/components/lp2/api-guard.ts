/** LP2 exclusivamente visual: bloqueio explícito de todas as chamadas HTTP do template original. */
export async function lp2Fetch(_input:RequestInfo|URL,_init?:RequestInit):Promise<Response>{
  return new Response(JSON.stringify({erro:'LP2 é uma prévia isolada: este formulário não envia nem grava informações. Use o portal principal.'}),{status:503,headers:{'Content-Type':'application/json'}})
}
