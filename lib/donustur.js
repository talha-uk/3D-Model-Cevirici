'use strict';

const fs = require('fs');
const path = require('path');
const sldprt = require('sldprt');
const { agYaz } = require('./ag');
const { hedefBul, kaynakBilgi, bilinenDosya, ayniBicim, uzanti } = require('./bicim');
const { olcuMm } = require('./glb');
const { assimpModel, occtModel } = require('./motor');
const { YolHatasi, varOlan, ciktiKlasoru } = require('./yol');

function olcuBirim(min, max) {
  const yazi = (sayi) => {
    const yuvarlak = Math.round(sayi * 1000) / 1000;
    return Number.isInteger(yuvarlak) ? String(yuvarlak) : String(yuvarlak);
  };
  return [0, 1, 2].map((i) => yazi(Math.abs(max[i] - min[i]))).join(' × ');
}

function parcalariBul(kaynak) {
  const bilgi = fs.statSync(kaynak);
  if (bilgi.isFile()) {
    kaynakYolu(kaynak);
    return [kaynak];
  }
  if (!bilgi.isDirectory()) throw new YolHatasi('Kaynak dosya veya klasör olmalı.');
  return fs.readdirSync(kaynak)
    .filter((ad) => bilinenDosya(ad))
    .sort((a, b) => a.localeCompare(b, 'tr'))
    .map((ad) => path.join(kaynak, ad));
}

function hataMetni(hata) {
  const metin = hata && hata.message ? hata.message : String(hata);
  if (/No supported face records|no faces/i.test(metin)) return 'Bu dosyada görüntü ağı yok.';
  if (/No Config-N-Partition/i.test(metin)) return 'Bu dosyada parça gövdesi yok.';
  if (/no STEP faces produced/i.test(metin)) return 'STEP yüzeyi çıkmadı.';
  if (metin === 'Dosyada üçgen yok.') return metin;
  return 'Dönüşüm olmadı: ' + metin.split('\n')[0].slice(0, 180);
}

function kaynakYolu(yol) {
  const gercek = varOlan(yol);
  if (!fs.statSync(gercek).isFile()) throw new YolHatasi('Seçilen öğe bir dosya değil.');
  if (path.basename(gercek).startsWith('~$')) throw new YolHatasi('Bu bir kilit dosyası.');
  const bilgi = kaynakBilgi(gercek);
  if (!bilgi) throw new YolHatasi('Bu biçim okunmuyor.');
  if (bilgi.motor === 'yok') throw new YolHatasi(bilgi.hata);
  return gercek;
}

function yazDosya(klasor, govdeAdi, uzantiAdi, buf) {
  const hedef = path.join(klasor, govdeAdi + uzantiAdi);
  const gecici = hedef + '.yaziliyor';
  try {
    fs.writeFileSync(gecici, buf);
    fs.renameSync(gecici, hedef);
  } catch (hata) {
    try { fs.unlinkSync(gecici); } catch { /* yarım dosya kalmasın */ }
    throw hata;
  }
  return hedef;
}

function sldprtModel(yol) {
  const model = sldprt.meshModel(yol);
  const kaynak = model.source === 'display mesh' ? 'görüntü ağı' : 'gövde üçgeni';
  return { model, kaynak };
}

function sldprtStep(yol, ad) {
  const stepAd = ad.replace(/[^\x20-\x7E]/g, '_') || 'model';
  try {
    const sonuc = sldprt.toSTEP(yol, { mode: 'exact', name: stepAd });
    return { metin: sonuc.text, kaynak: 'katı, milimetre' };
  } catch {
    const sonuc = sldprt.toSTEP(yol, { mode: 'mesh', name: stepAd });
    return { metin: sonuc.text, kaynak: 'üçgen kabuk, milimetre' };
  }
}

function agStep(model, ad) {
  const stepAd = ad.replace(/[^\x20-\x7E]/g, '_') || 'model';
  const sonuc = sldprt.convert.toSTEP(model, { mode: 'faceted', scale: 1, name: stepAd });
  return { metin: sonuc.text, kaynak: 'üçgen kabuk' };
}

async function modelOku(yol) {
  const bilgi = kaynakBilgi(yol);
  if (bilgi.motor === 'sldprt') return { tur: 'sldprt' };
  if (bilgi.motor === 'occt') {
    return { tur: 'ag', model: await occtModel(yol, bilgi.occt), kaynak: 'CAD üçgeni' };
  }
  return { tur: 'ag', model: await assimpModel(yol), kaynak: 'ağ' };
}

function govdeAdiSec(giris, klasor, hedef, kullanilan) {
  const kok = path.parse(giris).name;
  const duz = path.join(klasor, kok + hedef.uzanti);
  if (!kullanilan.has(duz)) {
    kullanilan.add(duz);
    return kok;
  }
  const ekli = kok + '.' + uzanti(giris);
  kullanilan.add(path.join(klasor, ekli + hedef.uzanti));
  return ekli;
}

async function birDosya(giris, klasor, hedef, govdeAdi) {
  const ad = path.basename(giris);
  if (ayniBicim(giris, hedef)) {
    const cikti = yazDosya(klasor, govdeAdi, hedef.uzanti, fs.readFileSync(giris));
    return { tamam: true, ad, cikti, bicim: hedef.ad, kaynak: 'kopya' };
  }
  const okunan = await modelOku(giris);
  if (hedef.id === 'step' && okunan.tur === 'sldprt') {
    const step = sldprtStep(giris, govdeAdi);
    const cikti = yazDosya(klasor, govdeAdi, '.step', step.metin);
    return { tamam: true, ad, cikti, bicim: hedef.ad, kaynak: step.kaynak };
  }
  const sld = okunan.tur === 'sldprt' ? sldprtModel(giris) : null;
  const model = sld ? sld.model : okunan.model;
  const kaynak = sld ? sld.kaynak : okunan.kaynak;
  if (hedef.id === 'step') {
    const step = agStep(model, govdeAdi);
    const cikti = yazDosya(klasor, govdeAdi, '.step', step.metin);
    return { tamam: true, ad, cikti, bicim: hedef.ad, kaynak: step.kaynak };
  }
  const yazilan = agYaz(hedef.id, model, govdeAdi);
  const cikti = yazDosya(klasor, govdeAdi, yazilan.uzanti, yazilan.buf);
  const olcu = sld ? olcuMm(yazilan.min, yazilan.max) : olcuBirim(yazilan.min, yazilan.max);
  return {
    tamam: true,
    ad,
    cikti,
    bicim: hedef.ad,
    ucgen: yazilan.ucgen,
    olcu,
    kaynak,
  };
}

async function donusturDosyalar(yollar, ciktiGiris, hedefId) {
  if (!Array.isArray(yollar) || !yollar.length) throw new YolHatasi('Önce dosya seçin.');
  const hedef = hedefBul(hedefId || 'glb');
  const dosyalar = yollar.map(kaynakYolu);
  const satirlar = [];
  const kullanilan = new Set();
  for (const dosya of dosyalar) {
    try {
      const klasor = ciktiKlasoru(ciktiGiris || '', dosya, hedef.klasor);
      const govdeAdi = govdeAdiSec(dosya, klasor, hedef, kullanilan);
      satirlar.push(await birDosya(dosya, klasor, hedef, govdeAdi));
    } catch (hata) {
      satirlar.push({
        tamam: false,
        ad: path.basename(dosya),
        hata: hata instanceof YolHatasi ? hata.message : hataMetni(hata),
      });
    }
  }
  const tamam = satirlar.filter((satir) => satir.tamam).length;
  return {
    satirlar,
    tamam,
    hata: satirlar.length - tamam,
    adet: dosyalar.length,
    klasor: hedef.klasor,
    bicim: hedef.ad,
  };
}

async function donustur(kaynakGiris, ciktiGiris, hedefId) {
  const kaynak = varOlan(kaynakGiris);
  const dosyalar = parcalariBul(kaynak);
  if (!dosyalar.length) throw new YolHatasi('Klasörde çevrilecek model yok.');
  return donusturDosyalar(dosyalar, ciktiGiris, hedefId);
}

module.exports = { donustur, donusturDosyalar, parcalariBul, hataMetni, kaynakYolu, uzanti };
