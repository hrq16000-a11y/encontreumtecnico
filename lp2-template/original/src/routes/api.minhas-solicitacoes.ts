import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/minhas-solicitacoes')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'minhas-solicitacoes'),
      POST:({request}:{request:Request})=>forward(request,'minhas-solicitacoes'),
      PUT:({request}:{request:Request})=>forward(request,'minhas-solicitacoes'),
      DELETE:({request}:{request:Request})=>forward(request,'minhas-solicitacoes')}}})
