import {createFileRoute,redirect} from '@tanstack/react-router'
export const Route=createFileRoute('/lp2/admin-portal')({beforeLoad:()=>{throw redirect({to:'/lp2/admin'})}})
