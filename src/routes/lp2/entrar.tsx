import {createFileRoute} from '@tanstack/react-router'
import {SignInPage} from '../entrar'
export const Route=createFileRoute('/lp2/entrar')({head:()=>({meta:[{title:'Entrar e criar conta | LP2 Encontre um Técnico'},{name:'robots',content:'noindex, nofollow'}]}),component:()=> <SignInPage lp2/>})
