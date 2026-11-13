'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { secimKaliplari } = require('./bicim');
const { YolHatasi, varOlan } = require('./yol');

let acik = false;

const BETIK = `
import sys
import tkinter as tk

def metin_yap(deger):
    # Coklu secim Tcl yol nesnesi doner. str degildir, encode yoktur.
    yol = getattr(deger, 'string', None)
    if yol is None:
        yol = deger
    if isinstance(yol, bytes):
        yol = yol.decode('utf-8')
    return str(yol)

def ayikla(yollar):
    temiz = []
    for yol in yollar:
        metin = metin_yap(yol)
        if metin:
            temiz.append(metin)
    return temiz

def yaz(yollar):
    if not yollar:
        raise SystemExit(1)
    sys.stdout.buffer.write(b'\\0'.join(yol.encode('utf-8') for yol in yollar))

try:
    if len(sys.argv) > 1 and sys.argv[1] == '--yol-nesnesi':
        root = tk.Tk()
        root.withdraw()
        nesneler = [root.tk.call('file', 'normalize', ham) for ham in sys.argv[2:]]
        yollar = ayikla(nesneler)
        root.destroy()
        yaz(yollar)
        raise SystemExit(0)
    baslangic = sys.argv[1]
    kaliplar = sys.argv[2] if len(sys.argv) > 2 else '{{3B model} {*}}'
    root = tk.Tk()
    root.withdraw()
    try:
        root.attributes('-topmost', True)
        root.lift()
    except tk.TclError:
        pass
    root.update()
    sonuc = root.tk.call(
        'tk_getOpenFile',
        '-multiple', '1',
        '-title', 'Modelleri seç',
        '-initialdir', baslangic,
        '-filetypes', kaliplar,
    )
    if isinstance(sonuc, (tuple, list)):
        hamlar = sonuc
    elif sonuc:
        hamlar = (sonuc,)
    else:
        hamlar = ()
    yollar = ayikla(hamlar)
    root.destroy()
    yaz(yollar)
except SystemExit:
    raise
except Exception as hata:
    sys.stderr.write(str(hata))
    raise SystemExit(2)
`;

function varsayilanKlasor() {
  const masaustu = path.join(os.homedir(), 'Desktop');
  return fs.existsSync(masaustu) ? masaustu : os.homedir();
}

function baslangicKlasoru(giris) {
  const varsayilan = varsayilanKlasor();
  if (!giris || typeof giris !== 'string') return varsayilan;
  try {
    const gercek = varOlan(giris);
    return fs.statSync(gercek).isDirectory() ? gercek : path.dirname(gercek);
  } catch {
    return varsayilan;
  }
}

function secimleriOku(metin) {
  const gorulen = new Set();
  const dosyalar = [];
  for (const ham of String(metin).split('\0')) {
    if (!ham || gorulen.has(ham)) continue;
    const gercek = varOlan(ham);
    gorulen.add(gercek);
    dosyalar.push({ ad: path.basename(gercek), yol: gercek });
  }
  dosyalar.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  return dosyalar;
}

function pythonCalistir(argumanlar) {
  return new Promise((olur, olmaz) => {
    const cocuk = spawn('python3', ['-', ...argumanlar], {
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' },
    });
    cocuk.stdin.end(BETIK);
    const parcalar = [];
    const hatalar = [];
    cocuk.stdout.on('data', (parca) => parcalar.push(parca));
    cocuk.stderr.on('data', (parca) => hatalar.push(parca));
    let bitti = false;
    function bitir(basarili, deger) {
      if (bitti) return;
      bitti = true;
      if (basarili) olur(deger);
      else olmaz(deger);
    }
    cocuk.on('error', () => bitir(false, new YolHatasi('Dosya seçme penceresi açılmadı.')));
    cocuk.on('close', (kod) => {
      try {
        const metin = Buffer.concat(parcalar).toString('utf-8');
        const hataMetin = Buffer.concat(hatalar).toString('utf-8').trim();
        if (kod === 1 || (kod !== 0 && !metin && !hataMetin)) {
          bitir(true, []);
          return;
        }
        if (kod !== 0) {
          if (hataMetin) console.error(hataMetin);
          bitir(false, new YolHatasi('Dosya seçilemedi.'));
          return;
        }
        bitir(true, secimleriOku(metin));
      } catch (hata) {
        bitir(false, hata instanceof YolHatasi ? hata : new YolHatasi('Dosya seçilemedi.'));
      }
    });
  });
}

function dosyaSec(baslangic) {
  if (acik) return Promise.reject(new YolHatasi('Dosya penceresi zaten açık.'));
  acik = true;
  const klasor = baslangicKlasoru(baslangic);
  return pythonCalistir([klasor, secimKaliplari()]).finally(() => {
    acik = false;
  });
}

function yolNesnesiOku(yollar) {
  return pythonCalistir(['--yol-nesnesi', ...yollar]);
}

module.exports = { dosyaSec, secimleriOku, yolNesnesiOku };
