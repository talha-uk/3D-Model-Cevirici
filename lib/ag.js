'use strict';

const { glbYaz } = require('./glb');

function normal(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  if (Math.hypot(nx, ny, nz) < 1e-12) return null;
  return true;
}

function duzle(model) {
  const vertices = [];
  const triangles = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const yuz of model.faces || []) {
    const yerel = yuz.vertices || [];
    const taban = vertices.length;
    for (const nokta of yerel) vertices.push(nokta);
    for (const tri of yuz.triangles || []) {
      const a = yerel[tri[0]];
      const b = yerel[tri[1]];
      const c = yerel[tri[2]];
      if (!a || !b || !c || !normal(a, b, c)) continue;
      triangles.push([taban + tri[0], taban + tri[1], taban + tri[2]]);
      for (const nokta of [a, b, c]) {
        for (let k = 0; k < 3; k++) {
          if (nokta[k] < min[k]) min[k] = nokta[k];
          if (nokta[k] > max[k]) max[k] = nokta[k];
        }
      }
    }
  }
  return { vertices, triangles, min, max, ucgen: triangles.length };
}

function bosMu(ag) {
  if (!ag.ucgen) {
    const hata = new Error('Dosyada üçgen yok.');
    hata.name = 'GlbHatasi';
    throw hata;
  }
}

function sayi(deger) {
  if (!Number.isFinite(deger)) return '0';
  return String(Math.round(deger * 1e9) / 1e9);
}

function xml(metin) {
  return String(metin).replace(/[&<>"']/g, (harf) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[harf]));
}

function objYaz(model, ad) {
  const ag = duzle(model);
  bosMu(ag);
  const satir = ['o ' + String(ad).replace(/[\r\n]/g, ' ')];
  for (const nokta of ag.vertices) satir.push('v ' + nokta.map(sayi).join(' '));
  for (const tri of ag.triangles) satir.push('f ' + tri.map((i) => i + 1).join(' '));
  return { buf: Buffer.from(satir.join('\n') + '\n'), ...ag, uzanti: '.obj' };
}

function stlYaz(model) {
  const ag = duzle(model);
  bosMu(ag);
  const buf = Buffer.alloc(84 + 50 * ag.ucgen);
  buf.write('3D Model Çevirici', 0);
  buf.writeUInt32LE(ag.ucgen, 80);
  let yer = 84;
  for (const tri of ag.triangles) {
    const a = ag.vertices[tri[0]];
    const b = ag.vertices[tri[1]];
    const c = ag.vertices[tri[2]];
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const boy = Math.hypot(nx, ny, nz) || 1;
    buf.writeFloatLE(nx / boy, yer);
    buf.writeFloatLE(ny / boy, yer + 4);
    buf.writeFloatLE(nz / boy, yer + 8);
    const noktalar = [a, b, c];
    for (let i = 0; i < 3; i++) {
      buf.writeFloatLE(noktalar[i][0], yer + 12 + i * 12);
      buf.writeFloatLE(noktalar[i][1], yer + 16 + i * 12);
      buf.writeFloatLE(noktalar[i][2], yer + 20 + i * 12);
    }
    yer += 50;
  }
  return { buf, ...ag, uzanti: '.stl' };
}

function plyYaz(model) {
  const ag = duzle(model);
  bosMu(ag);
  const bas = [
    'ply',
    'format ascii 1.0',
    'element vertex ' + ag.vertices.length,
    'property float x',
    'property float y',
    'property float z',
    'element face ' + ag.ucgen,
    'property list uchar int vertex_indices',
    'end_header',
  ];
  const govde = ag.vertices.map((nokta) => nokta.map(sayi).join(' '));
  for (const tri of ag.triangles) govde.push('3 ' + tri.join(' '));
  return { buf: Buffer.from(bas.concat(govde).join('\n') + '\n'), ...ag, uzanti: '.ply' };
}

function daeYaz(model, ad) {
  const ag = duzle(model);
  bosMu(ag);
  const konum = [];
  for (const nokta of ag.vertices) konum.push(nokta.map(sayi).join(' '));
  const yuzler = ag.triangles.map((tri) => tri.join(' ')).join(' ');
  const metin = `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset><unit name="meter" meter="1"/><up_axis>Y_UP</up_axis></asset>
  <library_geometries>
    <geometry id="ag" name="${xml(ad)}">
      <mesh>
        <source id="konum">
          <float_array id="konum-dizi" count="${ag.vertices.length * 3}">${konum.join(' ')}</float_array>
          <technique_common>
            <accessor source="#konum-dizi" count="${ag.vertices.length}" stride="3">
              <param name="X" type="float"/>
              <param name="Y" type="float"/>
              <param name="Z" type="float"/>
            </accessor>
          </technique_common>
        </source>
        <vertices id="nokta"><input semantic="POSITION" source="#konum"/></vertices>
        <triangles count="${ag.ucgen}">
          <input semantic="VERTEX" source="#nokta" offset="0"/>
          <p>${yuzler}</p>
        </triangles>
      </mesh>
    </geometry>
  </library_geometries>
  <library_visual_scenes>
    <visual_scene id="sahne"><node name="${xml(ad)}"><instance_geometry url="#ag"/></node></visual_scene>
  </library_visual_scenes>
  <scene><instance_visual_scene url="#sahne"/></scene>
</COLLADA>
`;
  return { buf: Buffer.from(metin), ...ag, uzanti: '.dae' };
}

function gltfYaz(model, ad) {
  const glb = glbYaz(model, ad);
  const buf = glb.buf;
  const jsonBoy = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonBoy).toString('utf8'));
  const govdeYer = 20 + jsonBoy;
  const boy = json.buffers[0].byteLength;
  const bin = buf.subarray(govdeYer + 8, govdeYer + 8 + boy);
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
  return {
    buf: Buffer.from(JSON.stringify(json)),
    ucgen: glb.ucgen,
    min: glb.min,
    max: glb.max,
    uzanti: '.gltf',
  };
}

function agYaz(id, model, ad) {
  if (id === 'glb') {
    const glb = glbYaz(model, ad);
    return { ...glb, uzanti: '.glb' };
  }
  if (id === 'gltf') return gltfYaz(model, ad);
  if (id === 'obj') return objYaz(model, ad);
  if (id === 'stl') return stlYaz(model);
  if (id === 'ply') return plyYaz(model);
  if (id === 'dae') return daeYaz(model, ad);
  throw new Error('Bu hedef ağa yazılmıyor.');
}

function parcalariOku(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) throw new Error('GLB imzası yok.');
  const toplam = buf.readUInt32LE(8);
  let yer = 12;
  let json = null;
  let bin = null;
  while (yer + 8 <= buf.length && yer < toplam) {
    const boy = buf.readUInt32LE(yer);
    const tip = buf.readUInt32LE(yer + 4);
    const ic = buf.subarray(yer + 8, yer + 8 + boy);
    if (tip === 0x4e4f534a) json = JSON.parse(ic.toString('utf8'));
    else if (tip === 0x004e4942) bin = ic;
    yer += 8 + boy;
  }
  if (!json || !bin) throw new Error('GLB eksik.');
  return { json, bin };
}

function bilesenBoy(tip) {
  const boy = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[tip];
  if (!boy) throw new Error('GLB sayı türü okunmuyor.');
  return boy;
}

function okuSayi(bin, yer, tip) {
  if (tip === 5120) return bin.readInt8(yer);
  if (tip === 5121) return bin.readUInt8(yer);
  if (tip === 5122) return bin.readInt16LE(yer);
  if (tip === 5123) return bin.readUInt16LE(yer);
  if (tip === 5125) return bin.readUInt32LE(yer);
  if (tip === 5126) return bin.readFloatLE(yer);
  throw new Error('GLB sayı türü okunmuyor.');
}

function okuErisim(json, bin, indeks) {
  const erisim = json.accessors[indeks];
  if (!erisim || erisim.bufferView === undefined || erisim.sparse) throw new Error('GLB erişimi okunmuyor.');
  const gorunum = json.bufferViews[erisim.bufferView];
  const sayiAdet = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[erisim.type];
  if (!sayiAdet) throw new Error('GLB erişim türü okunmuyor.');
  const boy = bilesenBoy(erisim.componentType);
  const adim = gorunum.byteStride || boy * sayiAdet;
  const taban = (gorunum.byteOffset || 0) + (erisim.byteOffset || 0);
  const cikti = [];
  for (let i = 0; i < erisim.count; i++) {
    const yer = taban + i * adim;
    if (erisim.type === 'VEC3') {
      cikti.push([
        okuSayi(bin, yer, erisim.componentType),
        okuSayi(bin, yer + boy, erisim.componentType),
        okuSayi(bin, yer + boy * 2, erisim.componentType),
      ]);
    } else if (erisim.type === 'SCALAR') {
      cikti.push(okuSayi(bin, yer, erisim.componentType));
    } else {
      throw new Error('GLB erişim türü okunmuyor.');
    }
  }
  return cikti;
}

function glbModel(girdi) {
  const buf = Buffer.isBuffer(girdi) ? girdi : Buffer.from(girdi);
  const { json, bin } = parcalariOku(buf);
  const faces = [];
  for (const mesh of json.meshes || []) {
    for (const ilkel of mesh.primitives || []) {
      if (ilkel.mode !== undefined && ilkel.mode !== 4) continue;
      if (ilkel.attributes === undefined || ilkel.attributes.POSITION === undefined) continue;
      const vertices = okuErisim(json, bin, ilkel.attributes.POSITION);
      const triangles = [];
      if (ilkel.indices !== undefined) {
        const indis = okuErisim(json, bin, ilkel.indices);
        for (let i = 0; i + 2 < indis.length; i += 3) triangles.push([indis[i], indis[i + 1], indis[i + 2]]);
      } else {
        for (let i = 0; i + 2 < vertices.length; i += 3) triangles.push([i, i + 1, i + 2]);
      }
      if (triangles.length) faces.push({ vertices, triangles });
    }
  }
  if (!faces.length) {
    const hata = new Error('Dosyada üçgen yok.');
    hata.name = 'GlbHatasi';
    throw hata;
  }
  return { faces };
}

module.exports = { duzle, agYaz, glbModel };
