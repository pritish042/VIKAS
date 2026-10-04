'use client';
import type {Resource} from '@/lib/types';
export function BoardDirectory({resources}:{resources:Resource[]}){
 const entries=resources.filter(r=>r.directory);if(!entries.length)return null;
 const groups=[...new Set(entries.map(r=>`${r.directory!.board||'CBSE'}|${r.directory!.classLevel}|${r.directory!.academicSession}`))];
 return <>{groups.map(group=>{
  const rows=entries.filter(r=>`${r.directory!.board||'CBSE'}|${r.directory!.classLevel}|${r.directory!.academicSession}`===group);
  const info=rows[0].directory!,board=info.board||'CBSE',subjects=[...new Set(rows.map(r=>r.directory!.subject))];
  return <section key={group} aria-label={`${board} YouTube search directory`} className="chapter-resources"><h2>{board} video searches</h2><p className="inline-note">Class {info.classLevel} · {info.academicSession?`Session ${info.academicSession}`:'Academic session unspecified in source'}. These links open YouTube search results from the supplied directory. Choose a video after checking its topic and syllabus fit. Individual videos and full syllabus coverage have not been verified.</p>{subjects.map(subject=><details className="chapter-section" key={subject}><summary>{subject} · YouTube searches</summary><ul>{rows.filter(r=>r.directory!.subject===subject).map(r=><li key={r._id}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a><span className="muted"> · PDF page {r.directory!.sourcePage}</span></li>)}</ul></details>)}</section>;
 })}</>;
}
