'use strict';

const path = require('path');
const { YolHatasi } = require('./yol');

const HEDEFLER = [
  { id: 'glb', uzanti: '.glb', ad: 'GLB', klasor: 'glb', grup: 'Ağ' },
  { id: 'gltf', uzanti: '.gltf', ad: 'glTF', klasor: 'gltf', grup: 'Ağ' },
  { id: 'obj', uzanti: '.obj', ad: 'OBJ', klasor: 'obj', grup: 'Ağ' },
  { id: 'stl', uzanti: '.stl', ad: 'STL', klasor: 'stl', grup: 'Ağ' },
  { id: 'ply', uzanti: '.ply', ad: 'PLY', klasor: 'ply', grup: 'Ağ' },
  { id: 'dae', uzanti: '.dae', ad: 'Collada', klasor: 'dae', grup: 'Ağ' },
  { id: 'step', uzanti: '.step', ad: 'STEP', klasor: 'step', grup: 'CAD' },
];

const KAYNAKLAR = {
  sldprt: { motor: 'sldprt' },
  sldasm: { motor: 'yok', hata: 'Montaj dosyası dönüşmez.' },
  glb: { motor: 'assimp' },
  gltf: { motor: 'assimp' },
  obj: { motor: 'assimp' },
  stl: { motor: 'assimp' },
  ply: { motor: 'assimp' },
  fbx: { motor: 'assimp' },
  dae: { motor: 'assimp' },
  '3ds': { motor: 'assimp' },
  '3mf': { motor: 'assimp' },
  off: { motor: 'assimp' },
  dxf: { motor: 'assimp' },
  x: { motor: 'assimp' },
  step: { motor: 'occt', occt: 'step' },
  stp: { motor: 'occt', occt: 'step' },
  iges: { motor: 'occt', occt: 'iges' },
  igs: { motor: 'occt', occt: 'iges' },
  brep: { motor: 'occt', occt: 'brep' },
  brp: { motor: 'occt', occt: 'brep' },
};

function uzanti(dosya) {
  return path.extname(String(dosya)).slice(1).toLowerCase();
}

function hedefBul(id) {
  const istenen = String(id || 'glb').toLowerCase();
  const hedef = HEDEFLER.find((oge) => oge.id === istenen);
  if (!hedef) throw new YolHatasi('Bu hedef biçim yok.');
  return hedef;
}

function kaynakBilgi(dosya) {
  return KAYNAKLAR[uzanti(dosya)] || null;
}

function bilinenDosya(ad) {
  if (path.basename(ad).startsWith('~$')) return false;
  const bilgi = kaynakBilgi(ad);
  return !!(bilgi && bilgi.motor !== 'yok');
}

function ayniBicim(dosya, hedef) {
  const uz = uzanti(dosya);
  if (hedef.id === 'step') return uz === 'step' || uz === 'stp';
  return uz === hedef.id;
}

function secimKaliplari() {
  return Object.keys(KAYNAKLAR).join(',');
}

module.exports = {
  HEDEFLER,
  KAYNAKLAR,
  uzanti,
  hedefBul,
  kaynakBilgi,
  bilinenDosya,
  ayniBicim,
  secimKaliplari,
};
