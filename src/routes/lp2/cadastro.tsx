import {createFileRoute,Link} from '@tanstack/react-router'
import {TechnicianAreaPage} from '../area-tecnico'
export const Route=createFileRoute('/lp2/cadastro')({head:()=>({meta:[{title:'Cadastro profissional | LP2 Encontre um Técnico'},{name:'robots',content:'noindex, nofollow'}]}),component:CadastroLP2})
function CadastroLP2(){return <><div className="container"><div className="actions"><Link to="/lp2/entrar" className="btn secondary">Entrar ou criar conta</Link></div></div><TechnicianAreaPage/></>}
