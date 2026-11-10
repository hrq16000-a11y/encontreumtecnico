import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/perfil')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'perfil'),
      POST:({request}:{request:Request})=>forward(request,'perfil'),
      PUT:({request}:{request:Request})=>forward(request,'perfil'),
      DELETE:({request}:{request:Request})=>forward(request,'perfil')}}})
