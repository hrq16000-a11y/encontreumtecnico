import test from 'node:test'
import assert from 'node:assert/strict'
import {clean,matchesService,regionStatus,profileRoute} from '../src/lib/directory.ts'
const wp={id:'wp-joao-silva',nome:'João Silva',cidade:'São José dos Pinhais',uf:'PR',especialidade:'Manutenção de notebooks',url:'https://encontreumtecnico.com/tecnico/joao-silva/'}
const unknown={id:'wp-fernanda',nome:'Fernanda Rodrigues',cidade:'',uf:'',especialidade:'Redes Wi-Fi',url:'https://encontreumtecnico.com/tecnico/fernanda/'}
const uuid='e99a8655-7e4a-4319-a54c-4ab33164109c'
test('busca insensível a acentos e espaços',()=>assert.equal(clean('  São  JOSÉ  '),'sao jose'))
test('busca por nome sem acentos',()=>assert.equal(matchesService(wp,'joao'),true))
test('busca por termos do serviço',()=>assert.equal(matchesService(wp,'manutencao notebook'),true))
test('não atribui especialidade inexistente',()=>assert.equal(matchesService(wp,'conserto impressora'),false))
test('região pública confirmada pelos dados',()=>assert.equal(regionStatus(wp,'Sao Jose dos Pinhais','PR'),'matched'))
test('região diferente é excluída',()=>assert.equal(regionStatus(wp,'Curitiba','PR'),'different'))
test('região não preenchida é desconhecida, não confirmada',()=>assert.equal(regionStatus(unknown,'Curitiba','PR'),'unknown'))
test('UF diferente conhecida exclui mesmo se cidade estiver faltando',()=>assert.equal(regionStatus({...unknown,uf:'SP'},'Curitiba','PR'),'different'))
test('perfil original usa só URL oficial permitida',()=>assert.equal(profileRoute(wp),'joao-silva'))
test('perfil de novo técnico aprovado usa UUID do cadastro',()=>assert.equal(profileRoute({id:uuid,nome:'Técnico novo'}),uuid))
test('bloqueia URL de outro domínio',()=>assert.equal(profileRoute({...wp,url:'https://example.net/tecnico/joao-silva/'}),null))
test('bloqueia slugs com path injection',()=>assert.equal(profileRoute({...wp,url:'https://encontreumtecnico.com/tecnico/../../admin/'}),null))
