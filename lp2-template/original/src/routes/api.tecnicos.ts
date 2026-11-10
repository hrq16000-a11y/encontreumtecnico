import {createFileRoute} from '@tanstack/react-router'
import {forward} from '../server/proxy'
export const Route=createFileRoute('/api/tecnicos')({server:{handlers:{GET:({request}:{request:Request})=>forward(request,'tecnicos'),
      POST:({request}:{request:Request})=>forward(request,'tecnicos'),
      PUT:({request}:{request:Request})=>forward(request,'tecnicos'),
      DELETE:({request}:{request:Request})=>forward(request,'tecnicos')}}})
