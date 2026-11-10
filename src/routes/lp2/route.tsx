import {createFileRoute,Link,Outlet} from '@tanstack/react-router'
import {useState} from 'react'
import {ServiceIcon} from '../../components/lp2/ServiceIcon'
import '../../components/lp2/theme.css'

const logo='/lp2-assets/logo-original.webp'
export const Route=createFileRoute('/lp2')({
  head:()=>({meta:[{title:'LP2 | Encontre um Técnico — Prévia do tema TanStack'},{name:'robots',content:'noindex,nofollow'},{name:'description',content:'Prévia independente do tema original do Encontre um Técnico.'}]}),
  component:Lp2Layout,
})
function Lp2Layout(){
 const [menu,setMenu]=useState(false)
 const close=()=>setMenu(false)
 return <div className="lp2-theme" data-lp2-template="original-31d587cd">
  <a href="#lp2-main" className="skip-to-content">Pular para o conteúdo LP2</a>
  <div className="app-shell">
   <div className="site-topbar"><div className="container topbar-inner"><span><ServiceIcon name="spark" size={15}/> Plataforma de conexão entre clientes e técnicos independentes</span><a href="/" title="Voltar ao portal oficial">Portal principal <ServiceIcon name="arrow" size={14}/></a></div></div>
   <header className="header"><nav className="container nav" aria-label="Navegação da LP2" onKeyDown={e=>{if(e.key==='Escape')close()}}>
    <Link to="/lp2" aria-label="Encontre um Técnico LP2 - início" className="logo" onClick={close}><img src={logo} alt="Encontre um Técnico" width={260} height={39}/></Link>
    <button type="button" className="mobile-menu-button" aria-label={menu?'Fechar menu':'Abrir menu'} aria-expanded={menu} aria-controls="lp2-navigation" onClick={()=>setMenu(x=>!x)}><ServiceIcon name="menu" size={25}/></button>
    <div id="lp2-navigation" className={'nav-links'+(menu?' expanded':'')}>
     <Link to="/lp2" activeOptions={{exact:true}} onClick={close}>Início</Link>
     <Link to="/lp2/galeria" search={{q:'',city:''}} onClick={close}>Encontrar técnico</Link>
     <Link to="/lp2/atividades" onClick={close}>Solicitações</Link>
     <Link to="/lp2/cliente" onClick={close}>Para clientes</Link>
     <Link to="/lp2/cadastro" className="nav-button" onClick={close}>Sou técnico <ServiceIcon name="arrow" size={16}/></Link>
    </div>
   </nav></header>
   <aside className="lp2-preview-notice" role="status">LP2 · Prévia visual independente. Cadastros, login e operações administrativas estão desativados. <a href="/">Acessar o portal oficial</a>.</aside>
   <div id="lp2-main" tabIndex={-1}><Outlet/></div>
   <footer className="footer"><div className="container footer-main"><div><Link to="/lp2" aria-label="Encontre um Técnico LP2" className="footer-logo"><img width={220} height={33} src={logo} alt="Encontre um Técnico"/></Link><p>Conectamos pessoas e técnicos independentes de informática e tecnologia, com liberdade para negociar diretamente.</p></div><div><h3>Encontre</h3><Link to="/lp2/galeria" search={{q:'',city:''}}>Buscar profissionais</Link><Link to="/lp2/atividades">Solicitações</Link><Link to="/lp2/cliente">Área do cliente</Link></div><div><h3>Sou técnico</h3><Link to="/lp2/cadastro">Cadastrar gratuitamente</Link><Link to="/lp2/acompanhar">Acompanhar cadastro</Link><Link to="/lp2/meu-perfil">Gerenciar perfil</Link></div><div><h3>Portal</h3><Link to="/lp2/admin">Administração (prévia)</Link><a href="/">Portal principal</a><span>Template visual preservado, sem conexão ao banco</span></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Encontre um Técnico. Tema LP2 isolado.</span><span>LP2 de homologação — dados e formulários não operacionais</span></div></footer>
  </div>
 </div>
}
