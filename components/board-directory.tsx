'use client';
import type {Resource} from '@/lib/types';
export function BoardDirectory({resources}:{resources:Resource[]}){
 const entries=resources.filter(r=>r.directory);if(!entries.length)return null;
 const subjects=[...new Set(entries.map(r=>r.directory!.subject))];
 return <section aria-label="CBSE YouTube search directory" className="chapter-resources"><h2>CBSE video searches</h2><p className="inline-note">Class {entries[0].directory!.classLevel} · Session 2026–27. These links open YouTube search results from the supplied directory. Choose a video after checking its topic and syllabus fit. Individual videos and full syllabus coverage have not been verified.</p>{subjects.map(subject=><details className="chapter-section" key={subject}><summary>{subject} · YouTube searches</summary><ul>{entries.filter(r=>r.directory!.subject===subject).map(r=><li key={r._id}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a><span className="muted"> · PDF page {r.directory!.sourcePage}</span></li>)}</ul></details>)}</section>;
}
