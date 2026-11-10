import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/profissionais')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'profissionais'),
      POST:({request}:{request:Request})=>forward(request,'profissionais'),
      PUT:({request}:{request:Request})=>forward(request,'profissionais'),
      DELETE:({request}:{request:Request})=>forward(request,'profissionais')}}})
