'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { donusturDosyalar } = require('./lib/donustur');
const { dosyaSec } = require('./lib/sec');
const { YolHatasi, varOlan } = require('./lib/yol');

const PORT = 4177;
const KOSE = path.join(__dirname, 'public');
const TIP = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function kac(metin) {
  return String(metin).replace(/[&<>"']/g, (harf) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[harf]));
}

function govdeOku(istek) {
  return new Promise((olur, olmaz) => {
    const parcalar = [];
    let boy = 0;
    istek.on('data', (parca) => {
      boy += parca.length;
      if (boy > 1024 * 1024) {
        olmaz(new YolHatasi('İstek çok büyük.'));
        istek.destroy();
        return;
      }
      parcalar.push(parca);
    });
    istek.on('end', () => olur(Buffer.concat(parcalar).toString('utf8')));
    istek.on('error', olmaz);
  });
}

function jsonGonder(yanit, kod, nesne) {
  const govde = JSON.stringify(nesne);
  yanit.writeHead(kod, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  yanit.end(govde);
}

function htmlSonuc(sonuc, hata) {
  const satirlar = sonuc
    ? sonuc.satirlar.map((satir) => {
      if (satir.tamam) {
        const ek = (satir.ucgen ? satir.ucgen + ' üçgen. ' : '') + (satir.olcu ? kac(satir.olcu) + '. ' : '') + (satir.kaynak ? kac(satir.kaynak) + '.' : '');
        return '<li>Tamam. ' + kac(satir.ad) + '. ' + ek + '</li>';
      }
      return '<li>Hata. ' + kac(satir.ad) + '. ' + kac(satir.hata) + '</li>';
    }).join('')
    : '';
  const ozet = hata
    ? '<p role="status">' + kac(hata) + '</p>'
    : '<p role="status">' + sonuc.tamam + ' tamam, ' + sonuc.hata + ' hata. Çıktı, dosyanın yanındaki ' + kac(sonuc.klasor) + ' klasörüne yazıldı.</p>';
  return '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Sonuç | SLDPRT GLB</title></head><body><main><h1>Sonuç</h1>'
    + ozet + '<ul>' + satirlar + '</ul><p><a href="/">Geri</a></p></main></body></html>';
}

function statik(istekYol, yanit) {
  const temiz = decodeURIComponent(istekYol.split('?')[0]);
  const goreli = temiz === '/' ? 'index.html' : temiz.replace(/^\/+/, '');
  if (goreli.includes('\0') || goreli.split('/').includes('..')) return false;
  const abs = path.resolve(KOSE, goreli);
  if (abs !== KOSE && !abs.startsWith(KOSE + path.sep)) return false;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return false;
  const uzanti = path.extname(abs);
  if (!TIP[uzanti]) return false;
  yanit.writeHead(200, {
    'Content-Type': TIP[uzanti],
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(abs).pipe(yanit);
  return true;
}

async function alanlar(istek) {
  const tur = String(istek.headers['content-type'] || '');
  const ham = await govdeOku(istek);
  if (tur.includes('application/json')) {
    let veri;
    try {
      veri = JSON.parse(ham || '{}');
    } catch {
      throw new YolHatasi('İstek okunmadı.');
    }
    return {
      dosyalar: Array.isArray(veri.dosyalar) ? veri.dosyalar : [],
      hedef: typeof veri.hedef === 'string' ? veri.hedef : 'glb',
    };
  }
  return { dosyalar: [], hedef: 'glb' };
}

const sunucu = http.createServer(async (istek, yanit) => {
  try {
    const adres = new URL(istek.url, 'http://127.0.0.1');
    if (istek.method === 'POST' && adres.pathname === '/api/sec') {
      const ham = await govdeOku(istek);
      let baslangic = '';
      if (ham.trim()) {
        let veri;
        try {
          veri = JSON.parse(ham);
        } catch {
          throw new YolHatasi('İstek okunmadı.');
        }
        baslangic = typeof veri.baslangic === 'string' ? veri.baslangic : '';
      }
      const dosyalar = await dosyaSec(baslangic);
      jsonGonder(yanit, 200, { dosyalar });
      return;
    }
    if (istek.method === 'GET' && adres.pathname === '/api/indir') {
      const yol = varOlan(adres.searchParams.get('yol') || '');
      const indirUzanti = path.extname(yol).toLowerCase();
      const indirTip = {
        '.glb': 'model/gltf-binary',
        '.gltf': 'model/gltf+json',
        '.obj': 'text/plain; charset=utf-8',
        '.stl': 'model/stl',
        '.ply': 'text/plain; charset=utf-8',
        '.dae': 'model/vnd.collada+xml',
        '.step': 'model/step',
        '.stp': 'model/step',
      }[indirUzanti];
      if (!indirTip || !fs.statSync(yol).isFile()) {
        throw new YolHatasi('İndirilecek dosya yok.');
      }
      const dosyaAdi = path.basename(yol);
      const asciiAd = dosyaAdi.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
      yanit.writeHead(200, {
        'Content-Type': indirTip,
        'Content-Disposition': 'attachment; filename="' + asciiAd + "\"; filename*=UTF-8''" + encodeURIComponent(dosyaAdi),
        'Content-Length': fs.statSync(yol).size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      fs.createReadStream(yol).pipe(yanit);
      return;
    }
    if (istek.method === 'POST' && adres.pathname === '/api/donustur') {
      const { dosyalar, hedef } = await alanlar(istek);
      const jsonIstek = String(istek.headers.accept || '').includes('application/x-ndjson')
        || String(istek.headers['content-type'] || '').includes('application/json');
      const sonuc = await donusturDosyalar(dosyalar, '', hedef);
      if (!jsonIstek) {
        yanit.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        yanit.end(htmlSonuc(sonuc));
        return;
      }
      yanit.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      yanit.write(JSON.stringify({ tur: 'liste', adet: sonuc.adet }) + '\n');
      for (const satir of sonuc.satirlar) yanit.write(JSON.stringify({ tur: 'dosya', ...satir }) + '\n');
      yanit.end(JSON.stringify({
        tur: 'bitti',
        tamam: sonuc.tamam,
        hata: sonuc.hata,
        klasor: sonuc.klasor,
        bicim: sonuc.bicim,
      }) + '\n');
      return;
    }
    if (istek.method === 'GET' && statik(adres.pathname, yanit)) return;
    jsonGonder(yanit, 404, { hata: 'Sayfa yok.' });
  } catch (hata) {
    if (yanit.headersSent) {
      yanit.end();
      return;
    }
    const mesaj = hata instanceof YolHatasi ? hata.message : 'İstek tamamlanmadı.';
    const tur = String(istek.headers.accept || '');
    if (istek.method === 'POST' && !tur.includes('application/x-ndjson') && !String(istek.headers['content-type'] || '').includes('application/json')) {
      yanit.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      yanit.end(htmlSonuc(null, mesaj));
      return;
    }
    jsonGonder(yanit, hata instanceof YolHatasi ? 400 : 500, { hata: mesaj });
  }
});

if (require.main === module) {
  sunucu.requestTimeout = 0;
  sunucu.listen(PORT, '127.0.0.1', () => {
    console.log('http://127.0.0.1:' + PORT);
  });
}

module.exports = { sunucu };
