// Offline tooling only: npm install --prefix <tools> @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions draco3dgltf meshoptimizer
const {resolve}=require('node:path');
const root=resolve(process.argv[2],'node_modules')+'/';
const {NodeIO}=require(root+'@gltf-transform/core/dist/index.cjs');
const {ALL_EXTENSIONS}=require(root+'@gltf-transform/extensions/dist/index.cjs');
const {simplify,prune,draco}=require(root+'@gltf-transform/functions/dist/index.cjs');
(async()=>{const {MeshoptSimplifier}=await import(root+'meshoptimizer/index.js');await MeshoptSimplifier.ready;const d=require(root+'draco3dgltf');const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await d.createDecoderModule(),'draco3d.encoder':await d.createEncoderModule()});const doc=await io.read(process.argv[3]);await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:.55,error:.0007}),prune(),draco({method:'edgebreaker',encodeSpeed:5,decodeSpeed:5}));await io.write(process.argv[4],doc);let n=0;for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives())n+=p.getIndices().getCount()/3;console.log('triangles',n);})();
