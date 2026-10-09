import type {Chapter,ChapterMapping} from './chapter-catalogue';
import type {Resource} from './types';
const matches=(m:ChapterMapping,c:Chapter)=>m.chapterId===c.chapterId&&m.chapter.textbookEdition===c.textbookEdition&&m.chapter.textbookTitle===c.textbookTitle&&m.chapter.academicSession===c.academicSession;
export function visibleChapterGroups(chapters:Chapter[],resources:Resource[],query:string){
 const term=query.trim().toLowerCase();
 const rows=chapters.map(chapter=>({chapter,videos:resources.filter(r=>r.chapterMappings?.some(m=>matches(m,chapter))).sort((a,b)=>a.chapterMappings!.find(m=>matches(m,chapter))!.sequencePosition-b.chapterMappings!.find(m=>matches(m,chapter))!.sequencePosition||a.title.localeCompare(b.title))})).filter(({chapter,videos})=>!term||videos.length>0||`${chapter.officialSubjectName} ${chapter.chapterTitle} ${chapter.unitTitle||''} ${chapter.theme||''}`.toLowerCase().includes(term));
 return [...new Set(rows.map(({chapter})=>chapter.officialSubjectName))].map(subject=>({subject,rows:rows.filter(({chapter})=>chapter.officialSubjectName===subject).sort((a,b)=>a.chapter.chapterOrder-b.chapter.chapterOrder)}));
}
