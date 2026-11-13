'use strict';

// glTF birimi metredir. SLDPRT görüntü ağı da metre gelir, ölçek uygulanmaz.

function f32(dizi) {
  const gorunum = new Float32Array(dizi);
  return Buffer.from(gorunum.buffer, gorunum.byteOffset, gorunum.byteLength);
}

function sinir(buf) {
  const v = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const x = v[i + k];
      if (x < min[k]) min[k] = x;
      if (x > max[k]) max[k] = x;
    }
  }
  return { min, max };
}

function normal(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const boy = Math.hypot(nx, ny, nz);
  if (boy < 1e-12) return null;
  return [nx / boy, ny / boy, nz / boy];
}

function glbYaz(model, ad) {
  const konum = [];
  const normaller = [];
  let ucgen = 0;
  for (const yuz of model.faces || []) {
    for (const tri of yuz.triangles || []) {
      const a = yuz.vertices[tri[0]];
      const b = yuz.vertices[tri[1]];
      const c = yuz.vertices[tri[2]];
      if (!a || !b || !c) continue;
      const n = normal(a, b, c);
      if (!n) continue;
      for (const p of [a, b, c]) {
        konum.push(p[0], p[1], p[2]);
        normaller.push(n[0], n[1], n[2]);
      }
      ucgen += 1;
    }
  }
  if (!ucgen) {
    const hata = new Error('Dosyada üçgen yok.');
    hata.name = 'GlbHatasi';
    throw hata;
  }

  const konumBuf = f32(konum);
  const normalBuf = f32(normaller);
  const { min, max } = sinir(konumBuf);
  const govde = Buffer.concat([konumBuf, normalBuf]);
  const tepe = ucgen * 3;
  const json = {
    asset: { version: '2.0', generator: '3D Model Çevirici' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: ad }],
    meshes: [{
      name: ad,
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        material: 0,
        mode: 4,
      }],
    }],
    materials: [{
      name: 'parca',
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: [0.75, 0.76, 0.78, 1],
        metallicFactor: 0.04,
        roughnessFactor: 0.62,
      },
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: tepe,
        type: 'VEC3',
        min,
        max,
      },
      { bufferView: 1, componentType: 5126, count: tepe, type: 'VEC3' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: konumBuf.length, target: 34962 },
      { buffer: 0, byteOffset: konumBuf.length, byteLength: normalBuf.length, target: 34962 },
    ],
    buffers: [{ byteLength: govde.length }],
  };

  let metin = JSON.stringify(json);
  while (Buffer.byteLength(metin) % 4 !== 0) metin += ' ';
  const jsonBuf = Buffer.from(metin);
  const dolgu = (4 - (govde.length % 4)) % 4;
  const govdeParca = dolgu ? Buffer.concat([govde, Buffer.alloc(dolgu)]) : govde;
  const toplam = 12 + 8 + jsonBuf.length + 8 + govdeParca.length;
  const baslik = Buffer.alloc(12);
  baslik.writeUInt32LE(0x46546c67, 0);
  baslik.writeUInt32LE(2, 4);
  baslik.writeUInt32LE(toplam, 8);
  const jsonBas = Buffer.alloc(8);
  jsonBas.writeUInt32LE(jsonBuf.length, 0);
  jsonBas.writeUInt32LE(0x4e4f534a, 4);
  const govdeBas = Buffer.alloc(8);
  govdeBas.writeUInt32LE(govdeParca.length, 0);
  govdeBas.writeUInt32LE(0x004e4942, 4);
  return {
    buf: Buffer.concat([baslik, jsonBas, jsonBuf, govdeBas, govdeParca]),
    ucgen,
    min,
    max,
  };
}

function mmYazi(mm) {
  if (mm >= 100) return String(Math.round(mm));
  const basamak = mm >= 10 ? 10 : 100;
  const yuvarlak = Math.round(mm * basamak) / basamak;
  if (Number.isInteger(yuvarlak)) return String(yuvarlak);
  return yuvarlak.toFixed(mm >= 10 ? 1 : 2);
}

function olcuMm(min, max) {
  return [0, 1, 2].map((i) => mmYazi(Math.abs(max[i] - min[i]) * 1000)).join(' × ') + ' mm';
}

function glbOku(buf) {
  if (buf.length < 20) throw new Error('GLB kısa.');
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('GLB imzası yok.');
  if (buf.readUInt32LE(4) !== 2) throw new Error('GLB sürümü 2 değil.');
  if (buf.readUInt32LE(8) !== buf.length) throw new Error('GLB uzunluğu uyuşmuyor.');
  const jsonBoy = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('JSON parçası yok.');
  const json = JSON.parse(buf.subarray(20, 20 + jsonBoy).toString('utf8'));
  const govdeYer = 20 + jsonBoy;
  const govdeBoy = buf.readUInt32LE(govdeYer);
  if (buf.readUInt32LE(govdeYer + 4) !== 0x004e4942) throw new Error('BIN parçası yok.');
  if (govdeYer + 8 + govdeBoy !== buf.length) throw new Error('BIN uzunluğu uyuşmuyor.');
  const govde = buf.subarray(govdeYer + 8, govdeYer + 8 + govdeBoy);
  const gorunum = json.bufferViews[0];
  const erisim = json.accessors[0];
  if (erisim.count % 3 !== 0) throw new Error('Tepe sayısı üçgen değil.');
  if (gorunum.byteLength !== erisim.count * 12) throw new Error('Konum tamponu uyuşmuyor.');
  if (json.buffers[0].byteLength + ((4 - (json.buffers[0].byteLength % 4)) % 4) !== govdeBoy) {
    throw new Error('Tampon dolgusu uyuşmuyor.');
  }
  for (let k = 0; k < 3; k++) {
    if (!Number.isFinite(erisim.min[k]) || !Number.isFinite(erisim.max[k])) {
      throw new Error('Sınır sayısı geçersiz.');
    }
  }
  const kon = new Float32Array(govde.buffer, govde.byteOffset + gorunum.byteOffset, erisim.count * 3);
  for (let i = 0; i < kon.length; i++) {
    if (!Number.isFinite(kon[i])) throw new Error('Konumda sonsuz değer var.');
  }
  return { json, ucgen: erisim.count / 3, min: erisim.min, max: erisim.max };
}

module.exports = { glbYaz, olcuMm, glbOku };
