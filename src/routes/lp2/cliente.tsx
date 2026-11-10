import {createFileRoute} from '@tanstack/react-router'
import {ClientAreaPage} from '../area-cliente'
import {zodValidator} from '@tanstack/zod-adapter'
import {z} from 'zod'
export const Route=createFileRoute('/lp2/cliente')({
 validateSearch:zodValidator(z.object({tecnico:z.string().uuid().optional()})),
 head:()=>({meta:[{title:'Área do cliente | LP2 Encontre um Técnico'},{name:'robots',content:'noindex, nofollow'}]}),
 component:ClienteLP2,
})
function ClienteLP2(){const {tecnico}=Route.useSearch();return <ClientAreaPage tecnico={tecnico}/>}
