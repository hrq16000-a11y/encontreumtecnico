import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/admin')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'admin'),
      POST:({request}:{request:Request})=>forward(request,'admin'),
      PUT:({request}:{request:Request})=>forward(request,'admin'),
      DELETE:({request}:{request:Request})=>forward(request,'admin')}}})
