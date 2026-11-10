/** Public directory helpers. Never infer a professional's region or qualifications. */
export type DirectoryProfile={
 id:string;nome:string;especialidade?:string;servico?:string;cidade?:string;uf?:string;
 descricao?:string;imagem?:string;url?:string;whatsapp?:string;nomeInferido?:boolean
}
export const clean=(s:unknown)=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim()
export function matchesService(profile:DirectoryProfile,query:string){
 const terms=clean(query).split(' ').filter(Boolean)
 const haystack=clean([profile.nome,profile.especialidade,profile.servico,profile.descricao].filter(Boolean).join(' '))
 return terms.every(t=>haystack.includes(t))
}
export function regionStatus(profile:DirectoryProfile,city:string,uf:string):'matched'|'unknown'|'different'{
 const wantedCity=clean(city),wantedUf=clean(uf)
 const knownCity=clean(profile.cidade),knownUf=clean(profile.uf)
 if(wantedCity&&knownCity&&!knownCity.includes(wantedCity))return 'different'
 if(wantedUf&&knownUf&&knownUf!==wantedUf)return 'different'
 if((wantedCity&&!knownCity)||(wantedUf&&!knownUf))return 'unknown'
 return 'matched'
}
export function profileRoute(profile:DirectoryProfile):string|null{
 if(profile.url){
  try{
   const source=new URL(profile.url)
   if(source.protocol==='https:'&&source.hostname==='encontreumtecnico.com'){
    const found=/^\/tecnico\/([a-z0-9._%-]{2,160})\/?$/i.exec(source.pathname)
    if(found)return found[1] ?? null
   }
  }catch{return null}
 }
 if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.id))return profile.id
 return null
}

/** Adapter visual: a única fonte de perfis é a consulta pública aprovada da plataforma oficial. */
export function fromPublicTechnician(p: import('../../lib/technicians.functions').PublicTechnician):DirectoryProfile{
 return {
  id:p.id,
  nome:p.display_name,
  cidade:p.city,
  uf:p.state_uf??undefined,
  especialidade:p.specialties.join(', '),
  servico:p.service_slugs.join(', '),
  descricao:p.bio??undefined,
  imagem:undefined,
  nomeInferido:false
 }
}
