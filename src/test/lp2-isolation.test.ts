import {describe,expect,it} from 'vitest'
import {existsSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {buildPublicSitemapXml,SITE} from '../lib/public-sitemap'

const root=process.cwd()
const read=(p:string)=>readFileSync(resolve(root,p),'utf8')
const pages=['index.tsx','galeria.tsx','cadastro.tsx','acompanhar.tsx','meu-perfil.tsx','cliente.tsx','clientes.tsx','atividades.tsx','admin.tsx','admin-portal.tsx','tecnico.$slug.tsx','entrar.tsx']

describe('LP2 operacional: mesma base, temas separados',()=>{
 it('mantém as doze rotas LP2 independentes',()=>{
  for(const file of pages){
   const path='src/routes/lp2/'+file
   expect(existsSync(resolve(root,path)),path).toBe(true)
   expect(read(path),path).toContain("createFileRoute('/lp2/")
  }
 })
 it('usa somente consultas públicas aprovadas para diretório e perfis',()=>{
  expect(read('src/routes/lp2/index.tsx')).toContain('listApprovedTechnicians')
  expect(read('src/routes/lp2/galeria.tsx')).toContain('listApprovedTechnicians')
  expect(read('src/routes/lp2/tecnico.$slug.tsx')).toContain('getApprovedTechnician')
  expect(read('src/lib/technicians.functions.ts')).toContain('.eq("status", "aprovado")')
  for(const file of pages){
   const source=read('src/routes/lp2/'+file)
   expect(source,file).not.toContain('encontreumtecnico-migracao-git-')
   expect(source,file).not.toContain('https://wa.me/')
  }
 })
 it('usa os painéis e a autenticação do portal oficial, sem segundo banco',()=>{
  expect(read('src/routes/lp2/entrar.tsx')).toContain('SignInPage')
  for(const file of ['cadastro','acompanhar','meu-perfil','atividades'])
   expect(read('src/routes/lp2/'+file+'.tsx')).toContain('TechnicianAreaPage')
  for(const file of ['cliente','clientes'])
   expect(read('src/routes/lp2/'+file+'.tsx')).toContain('ClientAreaPage')
  expect(read('src/routes/lp2/admin.tsx')).toContain('AdminPage')
  expect(read('src/routes/lp2/galeria.tsx')).toContain('LegacyPublicArchive')
  expect(read('src/routes/lp2/index.tsx')).toContain('LP2LegacyTeaser')
  expect(read('src/components/lp2/legacy-teaser.tsx')).toContain('legacy_public_archive')
  expect(read('src/components/lp2/legacy-teaser.tsx')).not.toContain('whatsapp')
  expect(read('src/components/page-placeholder.tsx')).toContain('LP2EmbeddedContext')
 })
 it('é indexável nas páginas públicas e protege as privadas',()=>{
  const layout=read('src/routes/lp2/route.tsx')
  expect(layout).not.toContain("content:'noindex,nofollow'")
  expect(layout).not.toContain('Prévia visual independente')
  expect(layout).toContain('CookieNotice')
  for(const file of ['cadastro','acompanhar','meu-perfil','cliente','clientes','atividades','admin','entrar'])
    expect(read('src/routes/lp2/'+file+'.tsx')).toContain('noindex, nofollow')
  for(const file of ['index','galeria'])expect(read('src/routes/lp2/'+file+'.tsx')).toContain('canonical')
  const publicSitemap=read('src/lib/public-sitemap.ts')
  expect(read('src/routes/sitemap[.]xml.ts')).toContain('buildPublicSitemapIndexXml(graph)')
  expect(publicSitemap).toContain('"/lp2"')
  expect(publicSitemap).toContain('"/lp2/galeria"')
 })
 it('o sitemap inclui perfis públicos válidos sem expor dados privados',()=>{
  const xml=buildPublicSitemapXml([
    {public_slug:'tecnico-curitiba',updated_at:'2026-11-10T12:00:00Z'},
    {public_slug:'tecnico-curitiba'},
    {public_slug:'../admin'},
    {public_slug:'<dados-privados>'},
  ]);
  expect(SITE).toBe('https://www.encontreumtecnico.com.br');
  expect(xml).toContain('<loc>'+SITE+'/lp2</loc>');
  expect(xml).toContain('<loc>'+SITE+'/lp2/galeria</loc>');
  expect(xml).toContain('<loc>'+SITE+'/tecnicos/tecnico-curitiba</loc>');
  expect(xml.match(/<loc>[^<]+tecnico-curitiba<\/loc>/g)).toHaveLength(1);
  expect(xml).not.toContain('../admin');
  expect(xml).not.toContain('<dados-privados>');
  expect(xml).not.toContain('/area-cliente');
  const route=read('src/routes/sitemap[.]xml.ts');
  const graph = read('src/lib/public-seo-graph.functions.ts');
  expect(route).toContain('getPublicGraphSnapshot()');
  expect(graph).toContain('.eq("status", "aprovado")');
  expect(graph).toContain('readPublicEligibleRows(');
  expect(route).toContain('status: 503');
  expect(read('public/robots.txt')).toContain('Sitemap: '+SITE+'/sitemap.xml');
 });
 it('preserva CSS e imagens do template original sem afetar a home',()=>{
  const css=read('src/components/lp2/theme.css')
  expect(css).toContain('@scope (.lp2-theme)')
  expect(read('src/routes/lp2/route.tsx')).toContain('className="lp2-theme"')
  for(const file of ['logo-original.webp','favicon-original.webp','illustrations/hero-tech.svg'])
   expect(existsSync(resolve(root,'public/lp2-assets/'+file))).toBe(true)
 })
})
