import {createFileRoute} from '@tanstack/react-router'
import {ClientAreaPage} from '../area-cliente'
export const Route=createFileRoute('/lp2/clientes')({head:()=>({meta:[{title:'Meus clientes e solicitações | LP2 Encontre um Técnico'},{name:'robots',content:'noindex, nofollow'}]}),component:ClientAreaPage})
