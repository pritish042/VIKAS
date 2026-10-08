'use client';
import {useEffect,useRef} from 'react';
import {EditorState,Compartment} from '@codemirror/state';
import {EditorView,lineNumbers,highlightActiveLine,keymap} from '@codemirror/view';
import {defaultKeymap,history,historyKeymap} from '@codemirror/commands';
import {syntaxHighlighting,defaultHighlightStyle,bracketMatching} from '@codemirror/language';
import {cpp} from '@codemirror/lang-cpp';
import {python} from '@codemirror/lang-python';
import {java} from '@codemirror/lang-java';
import {html} from '@codemirror/lang-html';
import type {LabLanguage} from '@/lib/aprajita/contract';
const extension=(language:LabLanguage)=>({c:cpp,python,java,html}[language])();
export default function CodeEditor({value,language,onChange}:{value:string;language:LabLanguage;onChange:(value:string)=>void}){
 const host=useRef<HTMLDivElement>(null),view=useRef<EditorView|null>(null),callback=useRef(onChange),mode=useRef(new Compartment());callback.current=onChange;
 useEffect(()=>{if(!host.current)return;const editor=new EditorView({parent:host.current,state:EditorState.create({doc:value,extensions:[lineNumbers(),highlightActiveLine(),history(),bracketMatching(),syntaxHighlighting(defaultHighlightStyle),keymap.of([...defaultKeymap,...historyKeymap]),mode.current.of(extension(language)),EditorView.contentAttributes.of({'aria-label':'Code editor','spellcheck':'false'}),EditorView.updateListener.of(update=>{if(update.docChanged)callback.current(update.state.doc.toString());})]})});view.current=editor;return()=>{editor.destroy();view.current=null;};},[]); // External changes use the transactions below; editor state survives typing.
 useEffect(()=>{const editor=view.current;if(editor&&editor.state.doc.toString()!==value)editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:value}});},[value]);
 useEffect(()=>{view.current?.dispatch({effects:mode.current.reconfigure(extension(language))});},[language]);
 return <div className="lab-editor" ref={host}/>;
}
