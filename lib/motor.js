'use strict';

const fs = require('fs');
const path = require('path');
const { glbModel } = require('./ag');
const { YolHatasi } = require('./yol');

let assimpSoz;
let occtSoz;

function assimp() {
  if (!assimpSoz) {
    assimpSoz = require('assimpjs')().catch((hata) => {
      assimpSoz = null;
      throw hata;
    });
  }
  return assimpSoz;
}

function occt() {
  if (!occtSoz) {
    occtSoz = require('occt-import-js')().catch((hata) => {
      occtSoz = null;
      throw hata;
    });
  }
  return occtSoz;
}

function diziAl(alan) {
  if (!alan) return null;
  if (ArrayBuffer.isView(alan)) return alan;
  if (Array.isArray(alan)) return alan;
  if (alan.array && (ArrayBuffer.isView(alan.array) || Array.isArray(alan.array))) return alan.array;
  return null;
}

function agModel(result) {
  if (!result || !result.success) throw new YolHatasi('CAD dosyası okunmadı.');
  const faces = [];
  for (const mesh of result.meshes || []) {
    const konum = diziAl(mesh.attributes && mesh.attributes.position);
    if (!konum || konum.length < 9) continue;
    const vertices = [];
    for (let i = 0; i + 2 < konum.length; i += 3) vertices.push([konum[i], konum[i + 1], konum[i + 2]]);
    const triangles = [];
    const indis = diziAl(mesh.index);
    if (indis && indis.length >= 3) {
      for (let i = 0; i + 2 < indis.length; i += 3) triangles.push([indis[i], indis[i + 1], indis[i + 2]]);
    } else {
      for (let i = 0; i + 2 < vertices.length; i += 3) triangles.push([i, i + 1, i + 2]);
    }
    if (triangles.length) faces.push({ vertices, triangles });
  }
  if (!faces.length) throw new YolHatasi('CAD dosyasında üçgen yok.');
  return { faces };
}

async function assimpModel(yol) {
  let ajs;
  try {
    ajs = await assimp();
  } catch {
    throw new YolHatasi('Ağ çeviricisi açılmadı.');
  }
  const liste = new ajs.FileList();
  liste.AddFile(path.basename(yol), new Uint8Array(fs.readFileSync(yol)));
  const sonuc = ajs.ConvertFileList(liste, 'glb2');
  if (!sonuc.IsSuccess() || !sonuc.FileCount()) throw new YolHatasi('Bu ağ dosyası okunmadı.');
  return glbModel(sonuc.GetFile(0).GetContent());
}

async function occtModel(yol, tur) {
  let motor;
  try {
    motor = await occt();
  } catch {
    throw new YolHatasi('CAD çeviricisi açılmadı.');
  }
  const govde = new Uint8Array(fs.readFileSync(yol));
  const ayar = { linearUnit: 'meter' };
  let sonuc;
  if (tur === 'iges') sonuc = motor.ReadIgesFile(govde, ayar);
  else if (tur === 'brep') sonuc = motor.ReadBrepFile(govde, ayar);
  else sonuc = motor.ReadStepFile(govde, ayar);
  return agModel(sonuc);
}

module.exports = { assimpModel, occtModel };
