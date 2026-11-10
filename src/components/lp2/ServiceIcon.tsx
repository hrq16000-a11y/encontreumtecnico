import type {ReactNode} from 'react'
type Kind='laptop'|'desktop'|'wifi'|'printer'|'shield'|'server'|'smartphone'|'support'|'search'|'location'|'arrow'|'check'|'menu'|'chevron'|'user'|'briefcase'|'spark';
export function ServiceIcon({name,size=24,className=''}:{name:Kind;size?:number;className?:string}){
 const common={fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
 const paths:Record<Kind,ReactNode>={
 laptop:<><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M2 20h20l-2-4H4l-2 4Z M9 19h6"/></>,
 desktop:<><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5 M7 21h10 M7 8h10"/></>,
 wifi:<><path d="M2 9a16 16 0 0 1 20 0 M5 12a11 11 0 0 1 14 0 M8 15a6 6 0 0 1 8 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/></>,
 printer:<><path d="M6 9V3h12v6 M6 18H4a2 2 0 0 1-2-2v-5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2h-2"/><path d="M6 15h12v6H6z M17 12h1"/></>,
 shield:<><path d="M12 2 4 5v6c0 6 4 9 8 11 4-2 8-5 8-11V5l-8-3Z M9 12l2 2 4-4"/></>,
 server:<><rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M8 6.5h.01 M8 17.5h.01 M12 6.5h5 M12 17.5h5"/></>,
 smartphone:<><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2 M10 5h4"/></>,
 support:<><path d="M4 14v-3a8 8 0 0 1 16 0v3 M4 13h2v6H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z M18 13h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2v-6Z M19 19c0 2-3 3-7 3"/></>,
 search:<><circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/></>,
 location:<><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
 arrow:<><path d="M4 12h16 M14 6l6 6-6 6"/></>,
 check:<><path d="m5 12 5 5L20 7"/></>,
 menu:<><path d="M4 6h16 M4 12h16 M4 18h16"/></>,
 chevron:<><path d="m9 18 6-6-6-6"/></>,
 user:<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></>,
 briefcase:<><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 13h18 M10 13v2h4v-2"/></>,
 spark:<><path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z M20 17l.8 2.2L23 20l-2.2.8L20 23l-.8-2.2L18 20l2.2-.8L20 17Z"/></>
 };
 return <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...common}>{paths[name]}</svg>
}
