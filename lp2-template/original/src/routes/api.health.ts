import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/health')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'health'),
      POST:({request}:{request:Request})=>forward(request,'health'),
      PUT:({request}:{request:Request})=>forward(request,'health'),
      DELETE:({request}:{request:Request})=>forward(request,'health')}}})
