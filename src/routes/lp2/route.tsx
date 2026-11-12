import {createFileRoute,Link,Outlet} from '@tanstack/react-router'
import {useState} from 'react'
import {LP2EmbeddedContext} from '../../components/page-placeholder'
import {ServiceIcon} from '../../components/lp2/ServiceIcon'
import {CookieNotice} from '../../components/cookie-notice'
import '../../components/lp2/theme.css'

const logo='/lp2-assets/logo-original.webp'
export const Route=createFileRoute('/lp2')({
  head:()=>({meta:[{title:'Encontre um Técnico | Tema LP2'},{name:'description',content:'Encontre profissionais independentes no Brasil pela interface LP2, com cadastro e autenticação da mesma plataforma.'}]}),
  component:Lp2Layout,
})
function Lp2Layout(){
 const [menu,setMenu]=useState(false)
 const close=()=>setMenu(false)
 return <div className="lp2-theme" data-lp2-template="original-31d587cd">
  <a href="#lp2-main" className="skip-to-content">Pular para o conteúdo LP2</a>
  <div className="app-shell">
   <div className="site-topbar"><div className="container topbar-inner"><span><ServiceIcon name="spark" size={15}/> Plataforma de conexão entre clientes e técnicos independentes</span><Link to="/" title="Voltar ao portal oficial">Portal principal <ServiceIcon name="arrow" size={14}/></Link></div></div>
   <header className="header"><nav className="container nav" aria-label="Navegação da LP2" onKeyDown={e=>{if(e.key==='Escape')close()}}>
    <Link to="/lp2" aria-label="Encontre um Técnico LP2 - início" className="logo" onClick={close}><img src={logo} alt="Encontre um Técnico" width={260} height={39}/></Link>
    <button type="button" className="mobile-menu-button" aria-label={menu?'Fechar menu':'Abrir menu'} aria-expanded={menu} aria-controls="lp2-navigation" onClick={()=>setMenu(x=>!x)}><ServiceIcon name="menu" size={25}/></button>
    <div id="lp2-navigation" className={'nav-links'+(menu?' expanded':'')}>
     <Link to="/lp2" activeOptions={{exact:true}} onClick={close}>Início</Link>
     <Link to="/lp2/galeria" search={{q:'',city:''}} onClick={close}>Encontrar técnico</Link>
     <Link to="/lp2/atividades" onClick={close}>Solicitações</Link>
     <Link to="/lp2/cliente" onClick={close}>Para clientes</Link>
     <Link to="/lp2/entrar" onClick={close}>Entrar</Link>
     <Link to="/lp2/cadastro" className="nav-button" onClick={close}>Sou técnico <ServiceIcon name="arrow" size={16}/></Link>
    </div>
   </nav></header>
   <div id="lp2-main" tabIndex={-1}><LP2EmbeddedContext.Provider value={true}><Outlet/></LP2EmbeddedContext.Provider></div>
   <footer className="footer"><div className="container footer-main"><div><Link to="/lp2" aria-label="Encontre um Técnico LP2" className="footer-logo"><img width={220} height={33} src={logo} alt="Encontre um Técnico"/></Link><p>Conectamos pessoas e técnicos independentes de informática e tecnologia, com liberdade para negociar diretamente.</p></div><div><h3>Encontre</h3><Link to="/lp2/galeria" search={{q:'',city:''}}>Buscar profissionais</Link><Link to="/lp2/atividades">Solicitações</Link><Link to="/lp2/cliente">Área do cliente</Link></div><div><h3>Sou técnico</h3><Link to="/lp2/cadastro">Cadastrar gratuitamente</Link><Link to="/lp2/acompanhar">Acompanhar cadastro</Link><Link to="/lp2/meu-perfil">Gerenciar perfil</Link></div><div><h3>Portal</h3><Link to="/lp2/admin">Administração</Link><Link to="/">Portal principal</Link><span>Mesma base de técnicos e clientes do portal</span></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Encontre um Técnico. Tema LP2 isolado.</span><span>Outra interface, mesmas contas e solicitações</span></div></footer>
  </div>
  <CookieNotice/>
 </div>
}
