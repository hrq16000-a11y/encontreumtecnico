import {createFileRoute} from '@tanstack/react-router'
import {TechnicianAreaPage} from '../area-tecnico'
export const Route=createFileRoute('/lp2/meu-perfil')({head:()=>({meta:[{title:'Meu perfil profissional | LP2 Encontre um Técnico'},{name:'robots',content:'noindex, nofollow'}]}),component:TechnicianAreaPage})
