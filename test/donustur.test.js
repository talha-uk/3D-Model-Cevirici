'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { bilinenDosya } = require('../lib/bicim');
const { glbYaz, glbOku } = require('../lib/glb');
const { secimleriOku, pencereHazir } = require('../lib/sec');
const { donustur, donusturDosyalar } = require('../lib/donustur');
const { YolHatasi, varOlan } = require('../lib/yol');

function ornekKlasor() {
  const yol = process.env.SLDPRT_ORNEK;
  if (!yol || !fs.existsSync(yol)) return '';
  return fs.statSync(yol).isDirectory() ? yol : path.dirname(yol);
}

function ornekParca(ad) {
  const kok = ornekKlasor();
  if (!kok) return '';
  const dosya = path.join(kok, ad);
  return fs.existsSync(dosya) ? dosya : '';
}

test('tek üçgen geçerli GLB olur', () => {
  const model = {
    faces: [{
      vertices: [[0, 0, 0], [0.01, 0, 0], [0, 0.02, 0]],
      triangles: [[0, 1, 2]],
    }],
  };
  const yazilan = glbYaz(model, 'deneme');
  const okunan = glbOku(yazilan.buf);
  assert.strictEqual(okunan.ucgen, 1);
  assert.strictEqual(okunan.json.asset.version, '2.0');
  assert.ok(Math.abs(okunan.max[0] - 0.01) < 1e-6);
  assert.ok(Math.abs(okunan.max[1] - 0.02) < 1e-6);
});

test('ev dışındaki yol reddedilir', () => {
  assert.throws(() => varOlan('/etc/passwd'), YolHatasi);
});

test('dışarı bakan bağ reddedilir', () => {
  const bag = path.join(__dirname, 'disari-bag');
  try { fs.unlinkSync(bag); } catch { /* yoksa geç */ }
  fs.symlinkSync('/etc/passwd', bag);
  try {
    assert.throws(() => varOlan(bag), YolHatasi);
  } finally {
    fs.unlinkSync(bag);
  }
});

test('pakngo1 parçalarının hepsi GLB olur', async () => {
  const kaynak = ornekKlasor();
  if (!fs.existsSync(kaynak)) return;
  const klasor = fs.mkdtempSync(path.join(__dirname, 'cikti-'));
  try {
    const beklenen = fs.readdirSync(kaynak).filter((ad) => bilinenDosya(ad)).length;
    const sonuc = await donustur(kaynak, klasor);
    assert.strictEqual(sonuc.hata, 0);
    assert.strictEqual(sonuc.tamam, beklenen);
    assert.ok(beklenen > 0);
    for (const satir of sonuc.satirlar) {
      const okunan = glbOku(fs.readFileSync(satir.cikti));
      assert.ok(okunan.ucgen > 0, satir.ad);
      assert.strictEqual(okunan.ucgen, satir.ucgen);
    }
  } finally {
    fs.rmSync(klasor, { recursive: true, force: true });
  }
});

test('birden fazla parça seçimi okunur ve yan yana yazılır', async () => {
  const kaynak = ornekParca('ethernetsw.SLDPRT');
  if (!fs.existsSync(kaynak)) return;
  const kok = fs.mkdtempSync(path.join(__dirname, 'cikti-'));
  const bir = path.join(kok, 'bir.SLDPRT');
  const iki = path.join(kok, 'iki.SLDPRT');
  fs.copyFileSync(kaynak, bir);
  fs.copyFileSync(kaynak, iki);
  try {
    const secim = secimleriOku(bir + '\0' + iki);
    assert.deepStrictEqual(secim.map((dosya) => dosya.ad), ['bir.SLDPRT', 'iki.SLDPRT']);
    const sonuc = await donusturDosyalar(secim.map((dosya) => dosya.yol));
    assert.strictEqual(sonuc.tamam, 2);
    assert.strictEqual(sonuc.hata, 0);
    assert.ok(fs.existsSync(path.join(kok, 'glb', 'bir.glb')));
    assert.ok(fs.existsSync(path.join(kok, 'glb', 'iki.glb')));
  } finally {
    fs.rmSync(kok, { recursive: true, force: true });
  }
});

test('çoklu seçimin yol nesnesi listeye döner', () => {
  const kok = fs.mkdtempSync(path.join(__dirname, 'cikti-'));
  const bir = path.join(kok, 'bir.SLDPRT');
  const iki = path.join(kok, 'iki parca.SLDPRT');
  fs.writeFileSync(bir, 'x');
  fs.writeFileSync(iki, 'x');
  try {
    const secim = secimleriOku(bir + '\0' + iki);
    assert.deepStrictEqual(secim.map((dosya) => dosya.ad), ['bir.SLDPRT', 'iki parca.SLDPRT']);
    assert.deepStrictEqual(secim.map((dosya) => dosya.yol), [bir, iki].sort((a, b) => path.basename(a).localeCompare(path.basename(b), 'tr')));
  } finally {
    fs.rmSync(kok, { recursive: true, force: true });
  }
});

test('dosya penceresi hazırlanır', async () => {
  const dosyalar = await pencereHazir();
  assert.deepStrictEqual(dosyalar, []);
});

test('GLB parçanın yanındaki glb klasörüne yazılır', async () => {
  const kaynak = ornekParca('ethernetsw.SLDPRT');
  if (!fs.existsSync(kaynak)) return;
  const kok = fs.mkdtempSync(path.join(__dirname, 'cikti-'));
  const kopya = path.join(kok, 'ethernetsw.SLDPRT');
  fs.copyFileSync(kaynak, kopya);
  try {
    const sonuc = await donusturDosyalar([kopya]);
    assert.strictEqual(sonuc.tamam, 1);
    assert.strictEqual(sonuc.satirlar[0].cikti, path.join(kok, 'glb', 'ethernetsw.glb'));
    assert.strictEqual(glbOku(fs.readFileSync(sonuc.satirlar[0].cikti)).ucgen, 12);
  } finally {
    fs.rmSync(kok, { recursive: true, force: true });
  }
});

test('ethernetsw SLDPRT GLB olur', async () => {
  const kaynak = ornekParca('ethernetsw.SLDPRT');
  if (!kaynak) return;
  const klasor = fs.mkdtempSync(path.join(__dirname, 'cikti-'));
  try {
    const sonuc = await donustur(kaynak, klasor);
    assert.strictEqual(sonuc.tamam, 1);
    assert.strictEqual(sonuc.hata, 0);
    const buf = fs.readFileSync(sonuc.satirlar[0].cikti);
    const okunan = glbOku(buf);
    assert.strictEqual(okunan.ucgen, 12);
    assert.match(sonuc.satirlar[0].olcu, /118 × 42 × 158 mm/);
  } finally {
    fs.rmSync(klasor, { recursive: true, force: true });
  }
});

test('obj ağ biçimlerine ve step kabuğuna döner', async () => {
  const kok = fs.mkdtempSync(path.join(__dirname, 'cikti-'));
  const obj = path.join(kok, 'ucgen.obj');
  fs.writeFileSync(obj, 'v 0 0 0\nv 0.01 0 0\nv 0 0.02 0\nf 1 2 3\n');
  try {
    const glb = await donusturDosyalar([obj], '', 'glb');
    assert.strictEqual(glb.tamam, 1);
    assert.strictEqual(glb.satirlar[0].cikti, path.join(kok, 'glb', 'ucgen.glb'));
    assert.strictEqual(glbOku(fs.readFileSync(glb.satirlar[0].cikti)).ucgen, 1);

    const stl = await donusturDosyalar([obj], '', 'stl');
    const stlBuf = fs.readFileSync(stl.satirlar[0].cikti);
    assert.strictEqual(stlBuf.readUInt32LE(80), 1);
    assert.strictEqual(stlBuf.length, 84 + 50);

    const step = await donusturDosyalar([obj], '', 'step');
    const stepMetin = fs.readFileSync(step.satirlar[0].cikti, 'utf8');
    assert.match(stepMetin, /ISO-10303-21/);
    assert.match(step.satirlar[0].kaynak, /üçgen kabuk/);

    const geri = await donusturDosyalar([step.satirlar[0].cikti], '', 'obj');
    assert.strictEqual(geri.tamam, 1);
    assert.match(fs.readFileSync(geri.satirlar[0].cikti, 'utf8'), /^o /m);
    assert.ok(geri.satirlar[0].ucgen >= 1);
  } finally {
    fs.rmSync(kok, { recursive: true, force: true });
  }
});

test('sldprt step katı yazar ve kilit dosyasını reddeder', async () => {
  const ornek = path.join(__dirname, '../node_modules/sldprt/samples/sw2022/C00_cube_10mm.SLDPRT');
  const kok = fs.mkdtempSync(path.join(__dirname, 'cikti-'));
  const kilit = path.join(kok, '~$ornek.SLDPRT');
  fs.writeFileSync(kilit, 'x');
  try {
    const sonuc = await donusturDosyalar([ornek], kok, 'step');
    assert.strictEqual(sonuc.tamam, 1);
    const metin = fs.readFileSync(sonuc.satirlar[0].cikti, 'utf8');
    assert.match(metin, /ISO-10303-21/);
    assert.match(metin, /MANIFOLD_SOLID_BREP|CLOSED_SHELL|ADVANCED_FACE/);
    assert.match(sonuc.satirlar[0].kaynak, /katı/);
    const birlikte = await donusturDosyalar([ornek, kilit], kok, 'glb');
    assert.strictEqual(birlikte.tamam, 1);
    assert.strictEqual(birlikte.hata, 1);
    assert.match(birlikte.satirlar.find((satir) => !satir.tamam).hata, /kilit dosyası/);
  } finally {
    fs.rmSync(kok, { recursive: true, force: true });
  }
});
