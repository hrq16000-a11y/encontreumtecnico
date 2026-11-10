import {createFileRoute} from '@tanstack/react-router'
import {TechnicianAreaPage} from '../area-tecnico'
export const Route=createFileRoute('/lp2/acompanhar')({head:()=>({meta:[{title:'Acompanhar cadastro | LP2 Encontre um Técnico'},{name:'robots',content:'noindex, nofollow'}]}),component:TechnicianAreaPage})
