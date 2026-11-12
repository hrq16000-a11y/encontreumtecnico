import {createFileRoute,Link} from '@tanstack/react-router'
import {getApprovedTechnician} from '../../lib/technicians.functions'
import {ServiceIcon} from '../../components/lp2/ServiceIcon'
import {useActiveCategories,categoryLabel} from '../../hooks/use-active-categories'
import {useActiveServices,serviceLabel} from '../../hooks/use-active-services'

const ORIGIN='https://www.encontreumtecnico.com.br'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const Route=createFileRoute('/lp2/tecnico/$slug')({
 loader:({params})=>uuid.test(params.slug)?getApprovedTechnician({data:{id:params.slug}}):null,
 head:({loaderData,params})=>({
  meta:[
   {title:loaderData?`${loaderData.display_name} | Perfil LP2 Encontre um Técnico`:'Perfil indisponível — Encontre um Técnico'},
   {name:'description',content:loaderData?`Conheça serviços e região de atendimento de ${loaderData.display_name} em ${loaderData.city}. Solicite atendimento após entrar na plataforma.`:'Perfil profissional não disponível para consulta pública.'},
   {property:'og:url',content:`${ORIGIN}/lp2/tecnico/${params.slug}`},
   ...(!loaderData?[{name:'robots',content:'noindex, nofollow'}]:[])
  ],
  links:[{rel:'canonical',href:`${ORIGIN}/lp2/tecnico/${params.slug}`}]
 }),
 component:TechnicianProfile,
})
function TechnicianProfile(){
 const p=Route.useLoaderData()
 const {categories}=useActiveCategories()
 const {services}=useActiveServices()
 if(!p)return <main className="container"><div className="info-empty"><h1>Perfil indisponível</h1><p>Este cadastro ainda não está publicado ou não foi encontrado. Apenas técnicos aprovados aparecem no diretório.</p><Link to="/lp2/galeria" search={{q:'',city:''}} className="btn">Voltar à galeria</Link></div></main>
 return <main className="professional-profile"><div className="container">
 <nav className="breadcrumb" aria-label="Você está aqui"><Link to="/lp2">Início</Link><ServiceIcon name="chevron" size={14}/><Link to="/lp2/galeria" search={{q:'',city:''}}>Técnicos</Link><ServiceIcon name="chevron" size={14}/><span>{p.display_name}</span></nav>
 <div className="professional-profile-card">
 <div className="professional-cover"><div className="cover-orbit first"/><div className="cover-orbit second"/><div className="cover-icon"><ServiceIcon name="laptop" size={65}/></div></div>
 <div className="professional-profile-body">
 <div className="professional-avatar"><ServiceIcon name="user" size={55}/></div>
 <span className="professional-label">CADASTRO APROVADO NO PORTAL OFICIAL</span>
 <h1>{p.display_name}</h1>
 <p className="professional-location"><ServiceIcon name="location" size={18}/>{[p.city,p.state_uf,p.neighborhood,p.region].filter(Boolean).join(' • ')}</p>
 {p.online_now&&<p className="directory-warning">Este profissional esteve online recentemente; isso não garante disponibilidade imediata.</p>}
 <p className="professional-description">{p.bio||'Consulte as especialidades e solicite atendimento pela plataforma.'}</p>
 <div className="professional-actions">
 <Link to="/lp2/cliente" search={{tecnico:p.id}} className="btn">Solicitar atendimento <ServiceIcon name="arrow" size={17}/></Link>
 <Link to="/lp2/galeria" search={{q:'',city:''}} className="btn secondary">Ver outros técnicos</Link>
 </div></div></div>
 <div className="professional-detail-grid">
 <div className="professional-detail-card"><span><ServiceIcon name="briefcase" size={23}/></span><div><h2>Especialidades</h2><p>{p.specialties.map(s=>categoryLabel(s,categories)).join(', ')||'Não informadas'}</p></div></div>
 <div className="professional-detail-card"><span><ServiceIcon name="location" size={23}/></span><div><h2>Região de atendimento</h2><p>{[p.city,p.state_uf,p.neighborhood].filter(Boolean).join(' / ')}</p></div></div>
 <div className="professional-detail-card"><span><ServiceIcon name="shield" size={23}/></span><div><h2>Serviços e contato</h2><p>{p.service_slugs.map(s=>serviceLabel(s,services)).join(', ')||'Consulte o profissional.'} O contato é protegido por autenticação.</p></div></div>
 </div>
 <aside className="professional-note"><ServiceIcon name="shield" size={22}/><p>A publicação administrativa não representa certificação ou garantia do atendimento. Cliente e técnico utilizam a mesma plataforma e combinam as condições diretamente. Dados privados não são expostos em páginas públicas.</p></aside>
 </div></main>
}
