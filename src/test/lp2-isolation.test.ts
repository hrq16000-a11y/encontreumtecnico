import {describe,expect,it} from 'vitest'
import {existsSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'

const root=process.cwd()
const pages=['index.tsx','galeria.tsx','cadastro.tsx','acompanhar.tsx','meu-perfil.tsx','cliente.tsx','clientes.tsx','atividades.tsx','admin.tsx','admin-portal.tsx','tecnico.$slug.tsx']
const read=(p:string)=>readFileSync(resolve(root,p),'utf8')

describe('LP2 isolada - proteção contra regressões',()=>{
 it('mantém as onze páginas sob o namespace lp2',()=>{
  for(const file of pages){
   const path='src/routes/lp2/'+file
   expect(existsSync(resolve(root,path)),path).toBe(true)
   expect(read(path),path).toContain("createFileRoute('/lp2/")
  }
 })
 it('proíbe rede direta e APIs antigas em páginas LP2',()=>{
  for(const file of pages){
   const code=read('src/routes/lp2/'+file)
   expect(code,file).not.toMatch(/\bfetch\s*\(/)
   expect(code,file).not.toContain('encontreumtecnico-migracao-git-')
  }
  const api=read('src/components/lp2/common.tsx')
  expect(api).toContain('throw new Error(')
  expect(api).not.toMatch(/\bfetch\s*\(/)
  expect(read('src/components/lp2/api-guard.ts')).not.toMatch(/\bfetch\s*\(/)
 })
 it('mantém estilos originais confinados à LP2',()=>{
  const css=read('src/components/lp2/theme.css')
  expect(css).toContain('@scope (.lp2-theme)')
  expect(css).not.toMatch(/:root\s*\{/)
  expect(read('src/routes/lp2/route.tsx')).toContain('className="lp2-theme"')
  expect(read('src/routes/lp2/route.tsx')).toContain("content:'noindex,nofollow'")
 })
 it('contém todos os assets isolados',()=>{
  for(const file of ['logo-original.webp','favicon-original.webp','illustrations/hero-tech.svg']){
   expect(existsSync(resolve(root,'public/lp2-assets/'+file))).toBe(true)
  }
 })
})
