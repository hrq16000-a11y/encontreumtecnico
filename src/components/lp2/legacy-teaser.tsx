import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {Link} from '@tanstack/react-router'
import {supabase} from '../../integrations/supabase/client'
import {legacyAvatarUrl} from '../../lib/legacy-avatar-urls'
import {ServiceIcon} from './ServiceIcon'

type Historical={wp_post_id:number;display_name:string;sector_tags:string[];country_label:string;validation_status:'em_validacao'}
const publicArchive=supabase as unknown as SupabaseClient

/** Somente os campos do acervo público sanitizado; não expõe telefone, e-mail ou cadastros pendentes privados. */
export function LP2LegacyTeaser(){
 const [profiles,setProfiles]=useState<Historical[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 useEffect(()=>{
  let active=true
  void Promise.resolve(publicArchive.from('legacy_public_archive')
   .select('wp_post_id,display_name,sector_tags,country_label,validation_status')
   .eq('validation_status','em_validacao').order('wp_post_id',{ascending:true}).limit(4))
   .then(({data,error:queryError}:{data:Historical[]|null;error:unknown})=>{
    if(!active)return
    if(queryError)setError(true)
    else setProfiles(data??[])
    setLoading(false)
   }).catch(()=>{if(active){setError(true);setLoading(false)}})
  return()=>{active=false}
 },[])
 if(loading)return <div className="market-card loading-card" role="status" aria-label="Carregando acervo público"/>
 if(error||profiles.length===0)return <div className="info-empty"><h3>Perfis em atualização</h3><p>Consulte o diretório e o cadastro gratuito para encontrar profissionais disponíveis.</p><Link to="/lp2/galeria" search={{q:'',city:''}} className="btn">Explorar galeria</Link></div>
 return <>
 {profiles.map(p=><article className="market-card" key={p.wp_post_id}>
  <div className="profile-top"><div className="profile-avatar">{legacyAvatarUrl(p.wp_post_id)?<img src={legacyAvatarUrl(p.wp_post_id)!} alt={'Imagem pública já conferida de '+p.display_name} width={64} height={64} loading="lazy"/>:<ServiceIcon name="user" size={30}/>}</div><div className="profile-type">Histórico em validação</div></div>
  <h3>{p.display_name}</h3><p className="profile-sub">{p.sector_tags.join(', ')||'Especialidade em conferência'}</p>
  <p className="profile-description">Registro original do WordPress. A identidade, cidade e a disponibilidade ainda não foram confirmadas; contato bloqueado até a ativação.</p>
  <Link to="/lp2/galeria" search={{q:'',city:''}} className="profile-action">Ver acervo público <ServiceIcon name="arrow" size={16}/></Link>
 </article>)}
 </>}
