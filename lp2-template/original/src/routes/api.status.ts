import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/status')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'status'),
      POST:({request}:{request:Request})=>forward(request,'status'),
      PUT:({request}:{request:Request})=>forward(request,'status'),
      DELETE:({request}:{request:Request})=>forward(request,'status')}}})
