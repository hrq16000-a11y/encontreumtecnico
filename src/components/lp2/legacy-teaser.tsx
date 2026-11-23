import {useEffect,useState} from 'react'
import {Link} from '@tanstack/react-router'
import {legacyAvatarUrl} from '../../lib/legacy-avatar-urls'
import {publicLegacyDisplayName} from '../../lib/legacy-display-name'
import {readPublicLegacyArchivePage,type PublicLegacyArchiveProfile} from '../../lib/public-legacy-archive-rpc'
import {ServiceIcon} from './ServiceIcon'


/** Somente os campos do acervo público sanitizado; não expõe telefone, e-mail ou cadastros pendentes privados. */
export function LP2LegacyTeaser(){
 const [profiles,setProfiles]=useState<PublicLegacyArchiveProfile[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 useEffect(()=>{
  let active=true
  void readPublicLegacyArchivePage(4, 0)
   .then(({profiles})=>{if(active){setProfiles(profiles);setLoading(false)}})
   .catch(()=>{if(active){setError(true);setLoading(false)}})
  return()=>{active=false}
 },[])
 if(loading)return <div className="market-card loading-card" role="status" aria-label="Carregando acervo público"/>
 if(error||profiles.length===0)return <div className="info-empty"><h3>Perfis em atualização</h3><p>Consulte o diretório e o cadastro gratuito para encontrar profissionais disponíveis.</p><Link to="/lp2/galeria" search={{q:'',city:''}} className="btn">Explorar galeria</Link></div>
 return <>
 {profiles.map(p=><article className="market-card" key={p.wp_post_id}>
  <div className="profile-top"><div className="profile-avatar">{legacyAvatarUrl(p.wp_post_id)?<img src={legacyAvatarUrl(p.wp_post_id)!} alt={'Imagem pública do cadastro de '+publicLegacyDisplayName(p.display_name).display} width={64} height={64} loading="lazy"/>:<ServiceIcon name="user" size={30}/>}</div><div className="profile-type">Técnico</div></div>
  <h3>{publicLegacyDisplayName(p.display_name).display}</h3>
  <p className="profile-description">Cadastro histórico · região de atendimento a confirmar.</p>
  <Link to="/lp2/galeria" search={{q:'',city:''}} className="profile-action">Ver acervo público <ServiceIcon name="arrow" size={16}/></Link>
 </article>)}
 </>}
