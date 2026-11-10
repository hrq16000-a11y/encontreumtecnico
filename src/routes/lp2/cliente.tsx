import {createFileRoute} from '@tanstack/react-router'
import {ClientAreaPage} from '../area-cliente'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const Route=createFileRoute('/lp2/cliente')({
 validateSearch:(s:Record<string,unknown>)=>({tecnico:typeof s['tecnico']==='string'&&uuid.test(s['tecnico'])?s['tecnico']:undefined}),
 head:()=>({meta:[{title:'Área do cliente | LP2 Encontre um Técnico'},{name:'robots',content:'noindex, nofollow'}]}),
 component:ClienteLP2,
})
function ClienteLP2(){const {tecnico}=Route.useSearch();return <ClientAreaPage tecnico={tecnico}/>}
