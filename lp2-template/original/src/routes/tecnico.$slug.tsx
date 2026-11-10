import {createFileRoute,Link} from '@tanstack/react-router'
import {createServerFn} from '@tanstack/react-start'
import {ServiceIcon} from '../components/ServiceIcon'

type Profile={id:string;nome:string;descricao:string;cidade:string;uf:string;especialidade:string;url:string;imagem:string;nomeInferido:boolean;whatsapp?:string;origem?:'wordpress'|'novo';unavailable?:boolean}
const BACKEND='https://encontreumtecnico-migracao-git-feat-encontreumtec-211d15-msolus.vercel.app'
const ORIGIN='https://encontreumtecnico.com'

function unpack(s:string):string {return s.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;/gi,' ').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')}
function meta(content:string,field:string):string{
 for(const m of content.matchAll(/<meta\b[^>]*>/gi)){
  const tag=m[0];if(!tag.includes(field))continue
  const property=/(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
  if(property!==field)continue
  const value=/content\s*=\s*["']([^"']{0,2000})["']/i.exec(tag)?.[1]
  if(value)return unpack(value).replace(/<[^>]*>/g,'').trim()
 }
 return ''
}
const getProfile=createServerFn({method:'GET'}).validator((slug:string)=>slug).handler(async ({data:slug})=>{
 if(!/^[a-z0-9._%-]{2,160}$/i.test(slug))return null
 // UUID profiles are the approved accounts created on the new Vercel platform.
 if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)){
  try{
   let cursor:string|undefined=undefined
   for(let page=0;page<8;page++){
    const url=new URL(BACKEND+'/api/tecnicos')
    if(cursor)url.searchParams.set('cursor',cursor)
    const response=await fetch(url,{signal:AbortSignal.timeout(8000),cache:'no-store'})
    if(!response.ok)return null
    const payload=await response.json()
    const found=(payload.tecnicos||[]).find((record:{id?:string})=>record.id===slug)
    if(found)return {
     id:found.id,nome:found.nome,descricao:found.descricao||'',
     especialidade:found.especialidade||'',cidade:found.cidade||'',
     uf:found.uf||'',imagem:'',url:'',whatsapp:found.whatsapp||'',
     nomeInferido:false,origem:'novo'
    } as Profile
    if(!payload.cursor||payload.cursor===cursor)break
    cursor=payload.cursor
   }
  }catch{}
  return null
 }
 try{
  const r=await fetch(BACKEND+'/api/profissionais',{signal:AbortSignal.timeout(9000)})
  if(!r.ok)return null
  const data=await r.json()
  const profile=(data.profissionais||[]).find((p:any)=>p.url===ORIGIN+'/tecnico/'+slug+'/') as Profile|undefined
  if(!profile)return null
  const base:Profile={...profile,especialidade:profile.especialidade||'',cidade:profile.cidade||'',uf:profile.uf||'',descricao:profile.descricao||'',imagem:profile.imagem||'',nomeInferido:Boolean(profile.nomeInferido),origem:'wordpress'}
  try{
   const page=await fetch(base.url,{headers:{Accept:'text/html', 'User-Agent':'EncontreUmTecnico-Migracao/1.0'},signal:AbortSignal.timeout(4500)})
   if(page.ok&&(page.headers.get('content-type')||'').includes('text/html')){
    const html=await page.text()
    const name=meta(html,'og:title')
    const description=meta(html,'og:description')
    const image=meta(html,'og:image')
    if(name){base.nome=name.split(/\s[|–—]\s/)[0].slice(0,115);base.nomeInferido=false}
    if(description)base.descricao=description.slice(0,850)
    if(image){
     try{const u=new URL(image);if(['encontreumtecnico.com','www.encontreumtecnico.com'].includes(u.hostname)&&u.protocol==='https:')base.imagem=u.href}catch{}
    }
   }
  }catch{} // If the old WordPress is slow, keep the already-indexed public record.
  return base
 }catch{return null}
})

export const Route=createFileRoute('/tecnico/$slug')({
 loader:({params})=>getProfile({data:params.slug}),
 component:TechnicianProfile,
})
function TechnicianProfile(){
 const p=Route.useLoaderData()
 if(!p)return <main className="container"><div className="info-empty"><h1>Perfil em atualização</h1><p>Não foi possível localizar este perfil na prévia. Consulte os profissionais disponíveis na galeria.</p><Link to="/galeria" search={{q:'',city:''}} className="btn">Voltar à galeria</Link></div></main>
 const details=[p.especialidade,p.cidade,p.uf].filter(Boolean)
 return <main className="professional-profile"><div className="container">
 <nav className="breadcrumb" aria-label="Você está aqui"><Link to="/">Início</Link><ServiceIcon name="chevron" size={14}/><Link to="/galeria" search={{q:'',city:''}}>Técnicos</Link><ServiceIcon name="chevron" size={14}/><span>{p.nome}</span></nav>
 <div className="professional-profile-card">
 <div className="professional-cover"><div className="cover-orbit first"/><div className="cover-orbit second"/><div className="cover-icon"><ServiceIcon name="laptop" size={65}/></div></div>
 <div className="professional-profile-body"><div className="professional-avatar">{p.imagem?<img src={p.imagem} loading="lazy" alt={'Imagem pública do perfil de '+p.nome}/>:<ServiceIcon name="user" size={55}/>}</div><span className="professional-label">{p.origem==='novo'?'CADASTRO APROVADO NO NOVO PORTAL':'PERFIL PÚBLICO DA ORIGEM WORDPRESS'}</span><h1>{p.nome}</h1>{details.length?<p className="professional-location"><ServiceIcon name="location" size={18}/>{details.join(' • ')}</p>:<p className="professional-location">Informações de localização ainda não estruturadas</p>}
 {p.nomeInferido?<p className="directory-warning">Nome baseado no endereço do perfil. Confirme as informações na origem.</p>:null}
 <p className="professional-description">{p.descricao||'Este profissional possui um perfil público no portal de origem. Os detalhes completos do cadastro e formas de contato ainda estão sendo incorporados nesta versão.'}</p>
 <div className="professional-actions">{p.url?<a href={p.url} target="_blank" rel="noopener noreferrer" className="btn">Abrir perfil e contato original <ServiceIcon name="arrow" size={17}/></a>:p.whatsapp&&p.whatsapp.replace(/\D/g,'').length>=10?<a href={'https://wa.me/'+(p.whatsapp.replace(/\D/g,'').startsWith('55')?p.whatsapp.replace(/\D/g,''):'55'+p.whatsapp.replace(/\D/g,''))} target="_blank" rel="noopener noreferrer" className="btn">Conversar pelo WhatsApp <ServiceIcon name="arrow" size={17}/></a>:<span className="small">O profissional ainda não informou um contato público.</span>}<Link to="/galeria" search={{q:'',city:''}} className="btn secondary">Ver outros técnicos</Link></div></div>
 </div>
 <div className="professional-detail-grid"><div className="professional-detail-card"><span><ServiceIcon name="briefcase" size={23}/></span><div><h2>Especialidade</h2><p>{p.especialidade||'Consulte o perfil original'}</p></div></div><div className="professional-detail-card"><span><ServiceIcon name="location" size={23}/></span><div><h2>Região de atendimento</h2><p>{p.cidade?[p.cidade,p.uf].filter(Boolean).join(' / '):'Não informada na base pública importada'}</p></div></div><div className="professional-detail-card"><span><ServiceIcon name="shield" size={23}/></span><div><h2>Informações verificáveis</h2><p>{p.origem==='wordpress'?'Confira dados completos no portal WordPress original.':'Dados aprovados para publicação nesta plataforma, sem validação documental.'}</p></div></div></div>
 <aside className="professional-note"><ServiceIcon name="shield" size={22}/><p>{p.origem==='novo'?'Este é um cadastro aprovado na nova plataforma. A aprovação é administrativa e não representa certificação, comprovação de documentos ou garantia do serviço.':'Este perfil foi reconstruído exclusivamente a partir de informações públicas do WordPress. A exibição não representa verificação de documentos ou certificações, nem implica avaliação ou garantia de atendimento pela plataforma.'}</p></aside>
 </div></main>
}
