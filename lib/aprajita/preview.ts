export const PREVIEW_CSP="default-src 'none'; script-src 'none'; connect-src 'none'; img-src data:; media-src 'none'; style-src 'unsafe-inline'; font-src data:; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
// Browser-only HTML preparation. Scripts, external links, frames and refresh redirects are removed.
export function previewDocument(source:string){
 const doc=new DOMParser().parseFromString(source,'text/html');
 doc.querySelectorAll('script,iframe,frame,object,embed,meta,base,link,form').forEach(node=>node.remove());
 doc.querySelectorAll('*').forEach(node=>{for(const attribute of [...node.attributes]){
  const name=attribute.name.toLowerCase();
  if(name.startsWith('on')||['href','xlink:href','action','formaction','srcdoc','srcset','poster','background','ping'].includes(name)||(name==='src'&&!(node.tagName==='IMG'&&/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(attribute.value))))node.removeAttribute(attribute.name);
 }});
 const csp=doc.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content=PREVIEW_CSP;doc.head.prepend(csp);
 return '<!doctype html>'+doc.documentElement.outerHTML;
}
