import {useState} from 'react'
export const ufs='AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ')
export function Uf(){return <label className="field">UF *<select name="uf" defaultValue="" required><option value="">Selecione</option>{ufs.map(s=><option value={s} key={s}>{s}</option>)}</select></label>}
export function Notice({message,error=false}:{message:string,error?:boolean}){return message?<div role="status" className={'notice'+(error?' error':'')}>{message}</div>:null}
/** LP2 visual: não acessa as APIs nem recebe segredos do portal principal. */
export async function api(_url:string,_method:string='GET',_data?:unknown,_key?:string):Promise<any>{
  throw new Error('Esta é a prévia LP2. Operações de cadastro, login, consulta privada e administração estão desativadas. Use o portal principal.')
}
export function useFeedback(){const [message,setMessage]=useState('');const [error,setError]=useState(false);return {message,error,ok:(s:string)=>{setMessage(s);setError(false)},fail:(e:unknown)=>{setMessage(e instanceof Error?e.message:'Erro desconhecido');setError(true)},clear:()=>{setMessage('');setError(false)}}}
