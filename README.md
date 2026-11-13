# 3D Model Çevirici

Dosyayı seçersin, hedef biçimi seçersin, çıktı o dosyanın yanında yeni bir klasöre yazılır.

## Çalıştırma

Node.js 18 veya üstü gerekir. Dosya penceresi için Python 3, PyGObject ve GTK 3 gerekir. Ubuntu’da paket adları `python3-gi` ve `gir1.2-gtk-3.0`.

```bash
npm install
npm start
```

Adres: [http://127.0.0.1:4177](http://127.0.0.1:4177)

Komut satırı:

```bash
node donustur.js [glb|gltf|obj|stl|ply|dae|step] <model> [model2 ...]
```

Biçim yazılmazsa çıktı GLB olur.

## Kullanım

1. Dosya seç. Ctrl veya Shift ile birden fazla model seçilir. Pencere yeniden açılınca listeye eklenir.
2. Hedef biçimi seç.
3. Dönüştür.

Çıktı, kaynak dosyanın yanında hedefin adıyla açılan klasöre yazılır. Örnek: `parca.SLDPRT` için `glb/parca.glb` veya `step/parca.step`.

Yollar ev dizininin içinde kalır.

## Biçimler

Okunan: SLDPRT, STEP, IGES, BREP, FBX, glTF, GLB, OBJ, STL, PLY, Collada, 3DS, 3MF, OFF, DXF.

Yazılan: GLB, glTF, OBJ, STL, PLY, Collada, STEP.

SLDPRT görüntü ağı metredir ve ölçeklenmez. SLDPRT’den STEP katı modeldir ve milimetredir. Başka bir dosyadan STEP üçgen kabuktur. Renk ve iskelet taşınmaz. `~$` ile başlayan kilit dosyası ve SolidWorks montajı dönüşmez.

## Sınama

```bash
npm test
```

`SLDPRT_ORNEK` bir klasörü gösterirse o klasördeki parçalar da sınanır.

## Lisans

ISC. SolidWorks okuma [solidworks-converters](https://github.com/blussyya/solidworks-converters) kütüphanesiyle yapılır. Ağ okuma assimpjs, CAD okuma occt-import-js kullanır. Bu iki paket kendi lisanslarını taşır.
