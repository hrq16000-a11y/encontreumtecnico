import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/cliente')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'cliente'),
      POST:({request}:{request:Request})=>forward(request,'cliente'),
      PUT:({request}:{request:Request})=>forward(request,'cliente'),
      DELETE:({request}:{request:Request})=>forward(request,'cliente')}}})
