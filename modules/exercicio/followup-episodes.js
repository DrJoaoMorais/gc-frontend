// Organização clínica independente das prescrições e do acesso do doente.
export const EPISODE_STATES = {active:'Em curso',completed:'Concluído',interrupted:'Interrompido',archived:'Arquivo/testes'};
export const FOLLOWUP_TABS = [['current','Em curso'],['attention','Precisam de atenção'],['completed','Concluídos'],['interrupted','Interrompidos'],['archived','Arquivo/testes']];
const time=v=>new Date(v||0).getTime()||0;
export const newest=(a,b)=>time(b.created_at)-time(a.created_at)||String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id));
export function episodeState(state){return state==='completed'?'completed':['paused','abandoned','interrupted'].includes(state)?'interrupted':state==='archived'?'archived':'active';}
export function contextMatches(c,filter){return filter==='attention'?!c.episode.is_test&&c.signals.some(s=>!s.informational):c.episodeState===({current:'active'}[filter]||filter);}
export function selectFollowupRows(rows,filter,search=''){
 const term=search.toLocaleLowerCase('pt');
 return rows.filter(p=>p.name.toLocaleLowerCase('pt').includes(term)).map(p=>({...p,contexts:p.contexts.filter(c=>contextMatches(c,filter))})).filter(p=>p.contexts.length).sort((a,b)=>{
  if(filter==='attention'){const priority=p=>Math.min(...p.contexts.flatMap(c=>c.signals.map(s=>({clinical:0,plan:1,adherence:2,questionnaire:3}[s.kind]??4))));const difference=priority(a)-priority(b);if(difference)return difference;}
  return a.name.localeCompare(b.name,'pt');
 });
}
export function latestEpisodeEvents(events){const map=new Map();for(const event of [...events].sort(newest))if(!map.has(event.episode_id))map.set(event.episode_id,event);return [...map.values()].sort(newest);}
export function withinEpisode(value,episode){const t=time(value),end=Object.hasOwn(episode,'data_until')?episode.data_until:episode.closed_at;return (!episode.started_at||t>=time(episode.started_at))&&(!end||t<(Object.hasOwn(episode,'data_until')?time(end):time(end)+1));}
