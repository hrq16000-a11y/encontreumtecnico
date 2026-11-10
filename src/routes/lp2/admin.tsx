import {createFileRoute} from '@tanstack/react-router'
import {AdminPage} from '../admin'
export const Route=createFileRoute('/lp2/admin')({head:()=>({meta:[{title:'Administração | LP2 Encontre um Técnico'},{name:'robots',content:'noindex, nofollow'}]}),component:AdminPage})
