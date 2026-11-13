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
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gio

def filtre_yap(metin):
    ekler = {ek.strip().lower() for ek in metin.split(',') if ek.strip()}
    filtre = Gtk.FileFilter()
    filtre.set_name('3B model')
    def uygun(info, data):
        ad = (info.display_name or info.filename or '').lower()
        return any(ad.endswith('.' + ek) for ek in data)
    bayrak = Gtk.FileFilterFlags.DISPLAY_NAME | Gtk.FileFilterFlags.FILENAME
    filtre.add_custom(bayrak, uygun, ekler)
    return filtre

def hazir_mi(metin):
    filtre = filtre_yap(metin)
    bayrak = Gtk.FileFilterFlags.DISPLAY_NAME | Gtk.FileFilterFlags.FILENAME
    ornekler = (('a.SLDPRT', True), ('b.step', True), ('c.txt', False))
    for ad, beklenen in ornekler:
        info = Gtk.FileFilterInfo()
        info.contains = bayrak
        info.filename = ad
        info.display_name = ad
        if filtre.filter(info) != beklenen:
            sys.stderr.write(ad + '\\n')
            raise SystemExit(2)

def uri_yollari(dialog):
    yollar = []
    for uri in dialog.get_uris():
        yol = Gio.File.new_for_uri(uri).get_path()
        if yol:
            yollar.append(yol)
    return yollar

try:
    if len(sys.argv) > 1 and sys.argv[1] == '--hazirla':
        hazir_mi(sys.argv[2] if len(sys.argv) > 2 else '')
        raise SystemExit(0)
    baslangic = sys.argv[1]
    ekler = sys.argv[2] if len(sys.argv) > 2 else ''
    dialog = Gtk.FileChooserDialog(title='Modelleri seç', action=Gtk.FileChooserAction.OPEN)
    dialog.add_button('_Vazgeç', Gtk.ResponseType.CANCEL)
    dialog.add_button('_Aç', Gtk.ResponseType.ACCEPT)
    dialog.set_default_response(Gtk.ResponseType.ACCEPT)
    dialog.set_select_multiple(True)
    dialog.set_local_only(True)
    dialog.set_position(Gtk.WindowPosition.CENTER)
    dialog.set_keep_above(True)
    try:
        dialog.set_current_folder(baslangic)
    except Exception:
        pass
    dialog.add_filter(filtre_yap(ekler))
    tumu = Gtk.FileFilter()
    tumu.set_name('Tüm dosyalar')
    tumu.add_pattern('*')
    dialog.add_filter(tumu)
    kod = dialog.run()
    yollar = uri_yollari(dialog) if kod == Gtk.ResponseType.ACCEPT else []
    dialog.destroy()
    if not yollar:
        raise SystemExit(1)
    sys.stdout.buffer.write(b'\\0'.join(yol.encode('utf-8') for yol in yollar))
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
      env: {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ':0',
        // Portal, üst penceresi olmayan süreçte dosya penceresini göstermiyor.
        GDK_BACKEND: 'x11',
        GTK_USE_PORTAL: '0',
      },
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

function pencereHazir() {
  return pythonCalistir(['--hazirla', secimKaliplari()]);
}

module.exports = { dosyaSec, secimleriOku, pencereHazir };
