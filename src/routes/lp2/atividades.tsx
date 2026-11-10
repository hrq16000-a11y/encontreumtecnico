import {createFileRoute} from '@tanstack/react-router'
import {TechnicianAreaPage} from '../area-tecnico'
export const Route=createFileRoute('/lp2/atividades')({head:()=>({meta:[{title:'Solicitações e atividades | LP2 Encontre um Técnico'},{name:'robots',content:'noindex, nofollow'}]}),component:TechnicianAreaPage})
