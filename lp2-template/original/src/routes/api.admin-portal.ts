import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/admin-portal')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'admin-portal'),
      POST:({request}:{request:Request})=>forward(request,'admin-portal'),
      PUT:({request}:{request:Request})=>forward(request,'admin-portal'),
      DELETE:({request}:{request:Request})=>forward(request,'admin-portal')}}})
