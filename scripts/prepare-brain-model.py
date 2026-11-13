"""Extract intact visible brain anatomy from the CC BY-SA atlas GLB.
Usage: python3 scripts/prepare-brain-model.py source.glb output.glb
Preserves source geometry and Draco compression; drops hidden systems/textures.
"""
import json, struct, sys
from pathlib import Path
raw=Path(sys.argv[1]).read_bytes()
n=struct.unpack_from('<I',raw,12)[0]
src=json.loads(raw[20:20+n]); binary=raw[28+n:]
nodes=[node for node in src['nodes'] if node.get('extras',{}).get('bx_cat') in {'cortex','cerebellum','brainstem'}]
mesh_ids=sorted({node['mesh'] for node in nodes}); meshes=[src['meshes'][i] for i in mesh_ids]
accessor_ids=set();view_ids=set()
for mesh in meshes:
 for p in mesh['primitives']:
  accessor_ids.update(p.get('attributes',{}).values())
  if 'indices' in p: accessor_ids.add(p['indices'])
  for extension in p.get('extensions',{}).values():
   if 'bufferView' in extension: view_ids.add(extension['bufferView'])
  p.pop('material',None)
accessor_ids=sorted(accessor_ids)
for i in accessor_ids:
 if 'bufferView' in src['accessors'][i]: view_ids.add(src['accessors'][i]['bufferView'])
view_ids=sorted(view_ids); packed=bytearray(); views=[]
for i in view_ids:
 view=dict(src['bufferViews'][i]); start=view.get('byteOffset',0); data=binary[start:start+view['byteLength']]
 view['byteOffset']=len(packed);view['buffer']=0;packed.extend(data);packed.extend(b'\0'*((-len(packed))%4));views.append(view)
for mesh in meshes:
 for p in mesh['primitives']:
  p['attributes']={k:accessor_ids.index(v) for k,v in p['attributes'].items()}
  if 'indices' in p:p['indices']=accessor_ids.index(p['indices'])
  for e in p.get('extensions',{}).values():
   if 'bufferView' in e:e['bufferView']=view_ids.index(e['bufferView'])
accessors=[src['accessors'][i] for i in accessor_ids]
for a in accessors:
 if 'bufferView' in a:a['bufferView']=view_ids.index(a['bufferView'])
for node in nodes:node['mesh']=mesh_ids.index(node['mesh']);node.pop('children',None)
out={'asset':{'version':'2.0','copyright':'Z-Anatomy / BodyParts3D, DBCLS; atlas itayinbarr/brainproject. CC BY-SA 4.0. See brain-LICENSE.txt.'},'extensionsUsed':['KHR_draco_mesh_compression'],'extensionsRequired':['KHR_draco_mesh_compression'],'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(packed)}]}
j=json.dumps(out,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
result=struct.pack('<III',0x46546c67,2,28+len(j)+len(packed))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(packed),0x004e4942)+packed
Path(sys.argv[2]).write_bytes(result)
print(len(nodes),'anatomical structures;',len(result),'bytes')
