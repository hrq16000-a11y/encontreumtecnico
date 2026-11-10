import type {ReactNode} from 'react'
import {useState} from 'react'
import {createRootRoute,HeadContent,Scripts,Outlet,Link} from '@tanstack/react-router'
import {ServiceIcon} from '../components/ServiceIcon'
import '../styles.css'
const logo='/logo-original.webp'
export const Route=createRootRoute({
 head:()=>({meta:[{charSet:'utf-8'},{name:'viewport',content:'width=device-width, initial-scale=1'},{name:'robots',content:'noindex,nofollow'},{name:'description',content:'Encontre um Técnico: pesquise profissionais independentes de informática e tecnologia, conheça perfis e negocie o atendimento diretamente.'},{title:'Encontre um Técnico | Profissionais de informática e tecnologia'}]}),
 component:Root
})
function Root(){
 const [menu,setMenu]=useState(false)
 const close=()=>setMenu(false)
 return <Document><a href="#main-content" className="skip-to-content">Pular para o conteúdo</a><div className="app-shell">
  <div className="site-topbar"><div className="container topbar-inner"><span><ServiceIcon name="spark" size={15}/> Plataforma de conexão entre clientes e técnicos independentes</span><a href="https://encontreumtecnico.com/" target="_blank" rel="noopener noreferrer">Portal original <ServiceIcon name="arrow" size={14}/></a></div></div>
  <header className="header"><nav className="container nav" aria-label="Navegação principal" onKeyDown={event=>{if(event.key==='Escape')setMenu(false)}}>
   <Link to="/" aria-label="Encontre um Técnico - início" className="logo" onClick={close}><img src={logo} alt="Encontre um Técnico" width={260} height={39}/></Link>
   <button type="button" className="mobile-menu-button" aria-label={menu?'Fechar menu':'Abrir menu'} aria-expanded={menu} aria-controls="main-navigation" onClick={()=>setMenu(m=>!m)}><ServiceIcon name="menu" size={25}/></button>
   <div id="main-navigation" className={'nav-links'+(menu?' expanded':'')}>
    <Link to="/" activeOptions={{exact:true}} onClick={close}>Início</Link>
    <Link to="/galeria" search={{q:'',city:''}} onClick={close}>Encontrar técnico</Link>
    <Link to="/atividades" onClick={close}>Solicitações</Link>
    <Link to="/cliente" onClick={close}>Para clientes</Link>
    <Link to="/cadastro" className="nav-button" onClick={close}>Sou técnico <ServiceIcon name="arrow" size={16}/></Link>
   </div>
  </nav></header>
  <div id="main-content" tabIndex={-1}><Outlet/></div>
  <footer className="footer"><div className="container footer-main"><div><Link to="/" aria-label="Encontre um Técnico" className="footer-logo"><img width={220} height={33} src={logo} alt="Encontre um Técnico"/></Link><p>Conectamos pessoas e técnicos independentes de informática e tecnologia, com liberdade para negociar diretamente.</p></div><div><h3>Encontre</h3><Link to="/galeria" search={{q:'',city:''}}>Buscar profissionais</Link><Link to="/atividades">Solicitações</Link><Link to="/cliente">Área do cliente</Link></div><div><h3>Sou técnico</h3><Link to="/cadastro">Cadastrar gratuitamente</Link><Link to="/acompanhar">Acompanhar cadastro</Link><Link to="/meu-perfil">Gerenciar perfil</Link></div><div><h3>Portal</h3><Link to="/admin">Administração</Link><a href="https://encontreumtecnico.com/" target="_blank" rel="noopener noreferrer">Versão original WordPress</a><span>Contas antigas ainda em migração</span></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Encontre um Técnico. Plataforma de conexão entre profissionais e clientes.</span><span>Versão de homologação — funcionalidades históricas em migração</span></div></footer>
  </div></Document>
}
function Document({children}:{children:ReactNode}){return <html lang="pt-BR"><head><HeadContent/><link rel="icon" type="image/webp" href="/favicon-original.webp"/></head><body>{children}<Scripts/></body></html>}
