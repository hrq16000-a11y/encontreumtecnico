import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/cadastro')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'cadastro'),
      POST:({request}:{request:Request})=>forward(request,'cadastro'),
      PUT:({request}:{request:Request})=>forward(request,'cadastro'),
      DELETE:({request}:{request:Request})=>forward(request,'cadastro')}}})
