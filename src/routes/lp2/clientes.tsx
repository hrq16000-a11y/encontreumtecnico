import {createFileRoute,Link} from '@tanstack/react-router'
import {createServerFn} from '@tanstack/react-start'
import {useState} from 'react'
type Client={id:string;nome:string;setor:string;cidade:string;uf:string;descricao?:string}
/** Somente interface; dados de clientes isolados. */
const getClients=createServerFn({method:'GET'}).handler(async()=>[] as Client[])
export const Route=createFileRoute('/lp2/clientes')({loader:()=>getClients(),component:Clientes})
function Clientes(){const items=Route.useLoaderData();const [query,setQuery]=useState('');const visible=items.filter(x=>[x.nome,x.setor,x.cidade].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));return <main className="container"><h1>Clientes cadastrados</h1><p className="subtle">Perfis de clientes aprovados na nova plataforma. O histórico WordPress será incorporado após importação dos registros.</p><div className="panel"><label className="field">Nome, setor ou cidade<input value={query} onChange={e=>setQuery(e.target.value)}/></label></div><div className="grid">{visible.map(x=><article className="card" key={x.id}><h2>{x.nome}</h2><p className="small">{x.setor} · {x.cidade}/{x.uf}</p><p>{x.descricao||'Sem apresentação pública.'}</p></article>)}</div><div className="actions"><Link to="/lp2/cliente" className="btn">Cadastrar cliente</Link></div></main>}
