'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const EV = os.homedir();

class YolHatasi extends Error {
  constructor(mesaj) {
    super(mesaj);
    this.name = 'YolHatasi';
  }
}

function evIcinde(gercek) {
  const norm = path.resolve(gercek);
  return norm === EV || norm.startsWith(EV + path.sep);
}

function coz(giris) {
  if (typeof giris !== 'string' || !giris.trim() || giris.includes('\0')) {
    throw new YolHatasi('Yol boş veya geçersiz.');
  }
  const abs = path.resolve(giris.trim());
  if (!evIcinde(abs)) throw new YolHatasi('Yol ev dizininin dışında.');
  return abs;
}

function varOlan(giris) {
  const abs = coz(giris);
  let gercek;
  try {
    gercek = fs.realpathSync(abs);
  } catch {
    throw new YolHatasi('Yol yok.');
  }
  if (!evIcinde(gercek)) throw new YolHatasi('Yol ev dizininin dışında.');
  return gercek;
}

function ciktiKlasoru(istenen, kaynak, klasorAdi) {
  const kok = fs.statSync(kaynak).isDirectory() ? kaynak : path.dirname(kaynak);
  const ad = klasorAdi || 'glb';
  const hedef = istenen && String(istenen).trim() ? coz(istenen) : path.join(kok, ad);
  if (fs.existsSync(hedef)) {
    const gercek = fs.realpathSync(hedef);
    if (!evIcinde(gercek)) throw new YolHatasi('Çıktı klasörü ev dizininin dışında.');
    if (!fs.statSync(gercek).isDirectory()) throw new YolHatasi('Çıktı bir klasör olmalı.');
    return gercek;
  }
  const ebeveyn = path.dirname(hedef);
  let ebeveynGercek;
  try {
    ebeveynGercek = fs.realpathSync(ebeveyn);
  } catch {
    throw new YolHatasi('Çıktı klasörünün üstü yok.');
  }
  if (!evIcinde(ebeveynGercek)) throw new YolHatasi('Çıktı klasörü ev dizininin dışında.');
  fs.mkdirSync(hedef, { recursive: true });
  return fs.realpathSync(hedef);
}

module.exports = { EV, YolHatasi, evIcinde, coz, varOlan, ciktiKlasoru };
