import {createFileRoute,Link} from '@tanstack/react-router'
import {useState} from 'react'
import type {FormEvent} from 'react'
import {ServiceIcon} from '../components/ServiceIcon'
export const Route=createFileRoute('/cadastro')({component:Cadastro})
const states='AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ')
function Cadastro(){
 const [error,setError]=useState(''),[saving,setSaving]=useState(false),[copied,setCopied]=useState(false)
 const [created,setCreated]=useState<{id:string;chave:string}|null>(null)
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget
  const data=Object.fromEntries(new FormData(form).entries()) as Record<string,unknown>
  data.aceite=(form.elements.namedItem('aceite') as HTMLInputElement).checked
  data.autorizacaoPublica=(form.elements.namedItem('autorizacaoPublica') as HTMLInputElement).checked
  setSaving(true);setError('')
  try{
   const response=await fetch('/api/cadastro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
   const payload=await response.json()
   if(!response.ok)throw Error(payload.erro||'Não foi possível salvar o cadastro')
   if(!payload.id||!payload.chave)throw Error('Cadastro criado, mas o comprovante está indisponível. Entre em contato com a administração.')
   setCreated({id:payload.id,chave:payload.chave})
  }catch(e){setError(e instanceof Error?e.message:'Falha no cadastro')}finally{setSaving(false)}
 }
 async function copy(){
  if(!created)return
  try{await navigator.clipboard.writeText('Encontre um Técnico\nProtocolo: '+created.id+'\nChave: '+created.chave);setCopied(true)}
  catch{setError('A cópia automática não foi autorizada. Selecione e guarde o protocolo e a chave exibidos abaixo.')}
 }
 return <main className="signup-page"><div className="container">
  <nav className="breadcrumb" aria-label="Você está aqui"><Link to="/">Início</Link><ServiceIcon name="chevron" size={14}/><span>Cadastro de técnico</span></nav>
  <div className="signup-header"><span className="signup-icon"><ServiceIcon name="briefcase" size={28}/></span><div><p className="section-eyebrow">PARA PROFISSIONAIS INDEPENDENTES</p><h1>Seu próximo cliente pode encontrar você aqui.</h1><p>Crie um perfil gratuito, apresente seu trabalho e amplie sua visibilidade. Seu cadastro será publicado após a revisão da plataforma.</p></div></div>
  <div className="signup-layout">
  <section className="signup-form-area">
   {created?<div className="signup-success" role="status" aria-live="polite"><div className="success-icon"><ServiceIcon name="check" size={32}/></div><p className="section-eyebrow">CADASTRO RECEBIDO</p><h2>Pronto! Seus dados foram salvos.</h2><p>Seu cadastro está aguardando aprovação. Para acompanhar ou editar seu perfil, guarde estas informações em um lugar seguro.</p><div className="access-credentials"><label>Protocolo<div className="secret-value">{created.id}</div></label><label>Chave pessoal<div className="secret-value">{created.chave}</div></label></div><button type="button" className="btn" onClick={copy}>{copied?'Informações copiadas':'Copiar protocolo e chave'} <ServiceIcon name={copied?'check':'arrow'} size={16}/></button><p className="small">Por segurança, esta chave não será enviada por e-mail nesta fase. Não compartilhe com outras pessoas.</p><div className="actions"><Link to="/acompanhar" className="btn secondary">Acompanhar cadastro</Link><Link to="/meu-perfil" className="btn secondary">Meu perfil</Link></div></div>:<form className="signup-form" onSubmit={submit}>
    <div className="form-section-head"><span className="form-step">1</span><div><h2>Apresente seu trabalho</h2><p>As informações profissionais aprovadas aparecerão no diretório.</p></div></div>
    <div className="two"><label className="field">Nome profissional *<input name="nome" autoComplete="name" required minLength={3} maxLength={100} placeholder="Como você deseja ser encontrado?"/></label><label className="field">Especialidade principal *<input name="especialidade" required minLength={3} maxLength={100} placeholder="Ex.: informática e manutenção"/></label></div>
    <div className="two"><label className="field">Cidade de atendimento *<input name="cidade" autoComplete="address-level2" required minLength={2} maxLength={90} placeholder="Sua cidade"/></label><label className="field">UF *<select name="uf" required defaultValue=""><option value="">Selecione o estado</option>{states.map(s=><option key={s} value={s}>{s}</option>)}</select></label></div>
    <label className="field">Quais serviços você oferece?<textarea name="descricao" maxLength={900} placeholder="Conte sobre os equipamentos e sistemas com que trabalha, sua experiência e formas de atendimento." rows={5}/><span className="input-help">Descrição opcional, até 900 caracteres. Não inclua dados pessoais sensíveis.</span></label>
    <div className="form-section-head secondary-head"><span className="form-step">2</span><div><h2>Como entrar em contato</h2><p>Seu e-mail fica privado. WhatsApp profissional só será exibido com sua autorização.</p></div></div>
    <div className="two"><label className="field">E-mail privado *<input type="email" autoComplete="email" name="email" required maxLength={180} placeholder="seu@email.com"/></label><label className="field">WhatsApp profissional<input name="whatsapp" type="tel" autoComplete="tel" inputMode="tel" maxLength={19} placeholder="DDD + número"/></label></div>
    <div className="form-section-head secondary-head"><span className="form-step">3</span><div><h2>Confirme suas preferências</h2><p>Você decide quais informações profissionais podem aparecer publicamente.</p></div></div>
    <div className="signup-consent"><label className="check"><input name="aceite" type="checkbox" required/> Aceito o tratamento das informações necessárias ao cadastro e à operação da plataforma.</label><label className="check"><input name="autorizacaoPublica" type="checkbox" required/> Autorizo a publicação dos meus dados profissionais e do WhatsApp informado, após a aprovação do cadastro.</label></div>
    {error?<div className="notice error" role="alert">{error}</div>:null}
    <button type="submit" className="btn signup-submit" disabled={saving}>{saving?'Salvando seu cadastro…':'Enviar cadastro para aprovação'} <ServiceIcon name="arrow" size={18}/></button>
    <p className="signup-privacy"><ServiceIcon name="shield" size={17}/> Cadastro gratuito. Publicação condicionada à aprovação. Nenhuma avaliação ou certificação é atribuída automaticamente.</p>
   </form>}
  </section>
  <aside className="signup-aside"><div className="aside-art"><ServiceIcon name="laptop" size={85}/><div className="aside-floating"><ServiceIcon name="spark" size={22}/></div></div><h2>Mostre ao cliente o que você sabe fazer.</h2><p>Profissionais independentes merecem oportunidades de apresentar o próprio trabalho e negociar diretamente.</p><div className="aside-points"><span><ServiceIcon name="check" size={19}/> Perfil gratuito</span><span><ServiceIcon name="check" size={19}/> Especialidade em destaque</span><span><ServiceIcon name="check" size={19}/> Contato direto com o cliente</span><span><ServiceIcon name="check" size={19}/> Controle das suas informações</span></div><div className="aside-notice">Já possui um cadastro antigo no WordPress? Os dados históricos ainda estão em migração. Continue usando o <a href="https://encontreumtecnico.com/" target="_blank" rel="noopener noreferrer">portal original</a> até a conclusão.</div></aside>
  </div>
 </div></main>
}
