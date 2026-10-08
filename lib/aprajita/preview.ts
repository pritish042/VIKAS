export const PREVIEW_CSP="default-src 'none'; script-src 'none'; connect-src 'none'; img-src data:; media-src 'none'; style-src 'unsafe-inline'; font-src data:; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
// Browser-only HTML preparation. Scripts, external links, frames and refresh redirects are removed.
export function previewDocument(source:string){
 // A template stays inert during sanitization, including external image/frame URLs.
 const template=document.createElement('template');template.innerHTML=source;const doc=template.content;
 doc.querySelectorAll('script,iframe,frame,object,embed,meta,base,link,form').forEach(node=>node.remove());
 doc.querySelectorAll('*').forEach(node=>{for(const attribute of [...node.attributes]){
  const name=attribute.name.toLowerCase();
  if(name.startsWith('on')||['href','xlink:href','action','formaction','srcdoc','srcset','poster','background','ping'].includes(name)||(name==='src'&&!(node.tagName==='IMG'&&/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(attribute.value))))node.removeAttribute(attribute.name);
 }});
 return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"></head><body>${template.innerHTML}</body></html>`;
}
