import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/clientes')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'clientes'),
      POST:({request}:{request:Request})=>forward(request,'clientes'),
      PUT:({request}:{request:Request})=>forward(request,'clientes'),
      DELETE:({request}:{request:Request})=>forward(request,'clientes')}}})
