'use strict';

const { donusturDosyalar } = require('./lib/donustur');
const { hedefBul } = require('./lib/bicim');
const { YolHatasi } = require('./lib/yol');

function ayir(argv) {
  const args = argv.slice(2);
  let hedef = 'glb';
  if (args.length) {
    try {
      hedef = hedefBul(args[0]).id;
      args.shift();
    } catch {
      hedef = 'glb';
    }
  }
  return { hedef, dosyalar: args };
}

async function main() {
  const { hedef, dosyalar } = ayir(process.argv);
  if (!dosyalar.length) {
    console.error('Kullanım: node donustur.js [glb|gltf|obj|stl|ply|dae|step] <model> [model2 ...]');
    process.exit(1);
  }
  try {
    const sonuc = await donusturDosyalar(dosyalar, '', hedef);
    for (const satir of sonuc.satirlar) {
      if (satir.tamam) {
        console.log('tamam\t' + (satir.ucgen || '') + '\t' + (satir.olcu || '') + '\t' + (satir.kaynak || '') + '\t' + satir.cikti);
      } else {
        console.error('hata\t' + satir.ad + '\t' + satir.hata);
      }
    }
    console.log(sonuc.tamam + ' tamam, ' + sonuc.hata + ' hata. Çıktı, dosyanın yanındaki ' + sonuc.klasor + ' klasörüne yazıldı.');
    process.exit(sonuc.hata ? 1 : 0);
  } catch (hata) {
    console.error(hata instanceof YolHatasi ? hata.message : hata.message);
    process.exit(1);
  }
}

if (require.main === module) main();
