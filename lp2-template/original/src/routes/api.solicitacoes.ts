import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/solicitacoes')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'solicitacoes'),
      POST:({request}:{request:Request})=>forward(request,'solicitacoes'),
      PUT:({request}:{request:Request})=>forward(request,'solicitacoes'),
      DELETE:({request}:{request:Request})=>forward(request,'solicitacoes')}}})
