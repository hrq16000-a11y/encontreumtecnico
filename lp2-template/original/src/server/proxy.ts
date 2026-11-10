// Static, trusted bridge to the already-tested Vercel backend during gradual migration.
// No arbitrary destination, no forwarding of cookies or unrelated headers.
const ORIGIN='https://encontreumtecnico-migracao-git-feat-encontreumtec-211d15-msolus.vercel.app'
const VALID=new Set(['cadastro','tecnicos','profissionais','perfil','status','cliente','clientes','solicitacoes','minhas-solicitacoes','admin','admin-portal','health'])
export async function forward(request:Request,endpoint:string):Promise<Response>{
 if(!VALID.has(endpoint))return new Response(JSON.stringify({erro:'Rota inválida'}),{status:404})
 const target=new URL('/api/'+endpoint,ORIGIN)
 target.search=new URL(request.url).search
 const headers=new Headers({Accept:'application/json'})
 const ct=request.headers.get('content-type');if(ct)headers.set('Content-Type',ct)
 const auth=request.headers.get('authorization');if(auth?.startsWith('Bearer ')&&auth.length<1000)headers.set('Authorization',auth)
 try{const res=await fetch(target,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.text(),cache:'no-store',signal:AbortSignal.timeout(12000)})
 const body=await res.text();return new Response(body,{status:res.status,headers:{'Content-Type':res.headers.get('content-type')||'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'}})
 }catch{return new Response(JSON.stringify({erro:'Serviço temporariamente indisponível'}),{status:503,headers:{'Content-Type':'application/json'}})}
}
