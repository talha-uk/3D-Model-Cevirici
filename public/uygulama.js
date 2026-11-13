'use strict';

const form = document.getElementById('form');
const sec = document.getElementById('sec');
const gonder = document.getElementById('gonder');
const secHata = document.getElementById('sec-hata');
const secilenListe = document.getElementById('secilen');
const ilerlemeKutu = document.getElementById('ilerleme-kutu');
const ilerleme = document.getElementById('ilerleme');
const durum = document.getElementById('durum');
const sonuclar = document.getElementById('sonuclar');

let secilen = [];

function hataGoster(metin) {
  secHata.hidden = !metin;
  secHata.textContent = metin || '';
  if (metin) sec.focus();
}

function listeyiCiz() {
  secilenListe.replaceChildren();
  for (const dosya of secilen) {
    const li = document.createElement('li');
    const ad = document.createElement('span');
    ad.textContent = dosya.ad;
    const cikar = document.createElement('button');
    cikar.type = 'button';
    cikar.textContent = 'Çıkar';
    cikar.setAttribute('aria-label', dosya.ad + ' Çıkar');
    cikar.addEventListener('click', () => {
      const sira = secilen.findIndex((oge) => oge.yol === dosya.yol);
      secilen = secilen.filter((oge) => oge.yol !== dosya.yol);
      listeyiCiz();
      durum.textContent = secilen.length ? secilen.length + ' dosya seçildi.' : '';
      const dugmeler = secilenListe.querySelectorAll('button');
      const hedef = dugmeler[Math.min(sira, dugmeler.length - 1)] || sec;
      hedef.focus();
    });
    li.append(ad, cikar);
    secilenListe.append(li);
  }
}

const hedef = document.getElementById('hedef');

function satirEkle(satir) {
  const li = document.createElement('li');
  if (satir.tamam) {
    let metin = 'Tamam. ' + satir.ad + '. ';
    if (satir.ucgen) metin += satir.ucgen + ' üçgen. ';
    if (satir.olcu) metin += satir.olcu + '. ';
    if (satir.kaynak) metin += satir.kaynak + '. ';
    li.append(document.createTextNode(metin));
    const bag = document.createElement('a');
    bag.href = '/api/indir?yol=' + encodeURIComponent(satir.cikti);
    bag.textContent = satir.ad.replace(/\.[^.]+$/, '') + ' ' + (satir.bicim || 'dosya') + ' indir';
    li.append(bag);
  } else {
    li.textContent = 'Hata. ' + satir.ad + '. ' + satir.hata;
  }
  sonuclar.append(li);
}

sec.addEventListener('click', async () => {
  sec.disabled = true;
  hataGoster('');
  durum.textContent = 'Dosya penceresi açık.';
  let hata = '';
  try {
    const yanit = await fetch('/api/sec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baslangic: secilen.length ? secilen[0].yol : '' }),
    });
    const veri = await yanit.json();
    if (!yanit.ok) {
      hata = veri.hata || 'Dosya seçilemedi.';
      durum.textContent = '';
      return;
    }
    if (!veri.dosyalar.length) {
      durum.textContent = secilen.length ? 'Seçim iptal edildi.' : '';
      return;
    }
    const gorulen = new Set(secilen.map((dosya) => dosya.yol));
    for (const dosya of veri.dosyalar) {
      if (gorulen.has(dosya.yol)) continue;
      gorulen.add(dosya.yol);
      secilen.push(dosya);
    }
    secilen.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    listeyiCiz();
    durum.textContent = secilen.length + ' dosya seçildi.';
  } catch {
    hata = 'Sunucuya ulaşılamadı.';
    durum.textContent = '';
  } finally {
    sec.disabled = false;
    if (hata) hataGoster(hata);
  }
});

form.addEventListener('submit', async (olay) => {
  olay.preventDefault();
  if (!secilen.length) {
    hataGoster('Önce dosya seçin.');
    return;
  }
  gonder.disabled = true;
  hataGoster('');
  durum.textContent = '';
  sonuclar.replaceChildren();
  ilerlemeKutu.hidden = false;
  ilerleme.removeAttribute('value');
  try {
    const yanit = await fetch('/api/donustur', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
      },
      body: JSON.stringify({
        dosyalar: secilen.map((dosya) => dosya.yol),
        hedef: hedef.value,
      }),
    });
    const tur = yanit.headers.get('content-type') || '';
    if (!yanit.ok || tur.includes('application/json')) {
      const veri = await yanit.json();
      hataGoster(veri.hata || 'Dönüşüm olmadı.');
      ilerlemeKutu.hidden = true;
      return;
    }
    const okuyucu = yanit.body.getReader();
    const coz = new TextDecoder();
    let birikim = '';
    let biten = 0;
    while (true) {
      const { done, value } = await okuyucu.read();
      birikim += coz.decode(value || new Uint8Array(), { stream: !done });
      const parcalar = birikim.split('\n');
      birikim = parcalar.pop();
      for (const satir of parcalar) {
        if (!satir.trim()) continue;
        const olayKaydi = JSON.parse(satir);
        if (olayKaydi.tur === 'liste') {
          ilerleme.max = olayKaydi.adet;
          ilerleme.value = 0;
        } else if (olayKaydi.tur === 'dosya') {
          biten += 1;
          ilerleme.value = biten;
          satirEkle(olayKaydi);
        } else if (olayKaydi.tur === 'bitti') {
          durum.textContent = olayKaydi.tamam + ' tamam, ' + olayKaydi.hata + ' hata. Çıktı, dosyanın yanındaki ' + olayKaydi.klasor + ' klasörüne yazıldı.';
        }
      }
      if (done) break;
    }
  } catch {
    hataGoster('Sunucuya ulaşılamadı.');
    ilerlemeKutu.hidden = true;
  } finally {
    gonder.disabled = false;
  }
});
