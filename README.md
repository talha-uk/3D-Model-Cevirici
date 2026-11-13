# 3D Model Çevirici

Bilgisayarda çalışan bir 3D model çevirici. Dosya dışarı yüklenmez. Sunucu yalnız bu makinede, `127.0.0.1` adresinde dinler.

Dosyayı seçersin, hedef biçimi seçersin, çıktı o dosyanın yanına yazılır. Ağ biçimleri birbirine çevrilir. STEP, IGES ve BREP üçgene açılır. SolidWorks parçası görüntü ağı olarak ya da STEP katı model olarak çıkar.

## Çalıştırma

Node.js 18 veya üstü gerekir. Dosya penceresi için Python 3, PyGObject ve GTK 3 gerekir. Ubuntu’da paket adları `python3-gi` ve `gir1.2-gtk-3.0`.

```bash
npm install
npm start
```

Adres: [http://127.0.0.1:4177](http://127.0.0.1:4177)

`./baslat.sh` aynı sunucuyu açar.

Komut satırından da çevrilir. Biçim yazılmazsa çıktı GLB olur.

```bash
node donustur.js [glb|gltf|obj|stl|ply|dae|step] <model> [model2 ...]
```

## Kullanım

1. Dosya seç. Ctrl veya Shift ile birden fazla model seçilir. Pencere yeniden açılınca listeye eklenir. Listeden çıkarmak için Çıkar’a basılır.
2. Hedef biçimi seç. Ağ için GLB, glTF, OBJ, STL, PLY veya Collada. CAD için STEP.
3. Dönüştür.

Sonuç satırı bitince kaç dosyanın tamamlandığını ve klasör adını yazar. İndirme bağlantısı o dosyayı açar.

Çıktı, kaynak dosyanın yanında hedefin adıyla açılan klasöre yazılır.

```text
parca.SLDPRT
glb/parca.glb
step/parca.step
```

Aynı klasörde aynı adlı iki kaynak varsa ikincinin adına kendi uzantısı eklenir. `cannak.SLDPRT` ve `cannak.STEP` birlikte GLB olursa ikincisi `cannak.step.glb` olur.

Kaynak ile hedef aynı biçimse dosya yeniden üçgenlenmez, kopyalanır. `.stp` dosyası STEP hedefinde kopyadır.

Yollar ev dizininin içinde kalır. Ev dışındaki bir dosya veya ev dışına bakan bir bağ reddedilir.

Listedeki bir dosya bozuksa yalnız o satır hata yazar. Diğer dosyalar yazılmaya devam eder.

## Biçimler

| Okunur | Yazılır |
| --- | --- |
| SLDPRT | GLB, glTF, OBJ, STL, PLY, Collada, STEP |
| STEP, STP, IGES, IGS, BREP, BRP | Ağ biçimleri ve STEP |
| FBX, glTF, GLB, OBJ, STL, PLY, Collada, 3DS, 3MF, OFF, DXF, X | Ağ biçimleri ve STEP |

FBX, 3DS, 3MF, OFF, DXF, X, IGES ve BREP yalnız okunur. Bu biçimlere geri yazılmaz.

glTF tek dosyadır. Üçgen verisi dosyanın içine gömülür, yanında ayrı bir `.bin` açılmaz. STL ikili yazılır.

## Birimler

SLDPRT görüntü ağı metredir. GLB, glTF, OBJ, STL, PLY ve Collada çıktısında bu koordinat ölçeklenmez.

SLDPRT’den STEP önce katı model olarak yazılır. Birim milimetredir. Katı yüzey çıkmazsa aynı parçanın üçgen kabuğu, yine milimetre, yazılır.

Başka bir dosyadan STEP üçgen kabuktur. Koordinatlar ölçeklenmez. Bu kabuk, kaynak dosyadaki katı modeli geri getirmez.

## Taşınmayanlar

Renk, malzeme, iskelet ve animasyon taşınmaz. GLB ve glTF gri, çift yüzlü bir malzemeyle yazılır. OBJ, STL, PLY ve Collada yalnız üçgen geometrisini taşır.

`~$` ile başlayan dosya SolidWorks kilit dosyasıdır. Dönüşmez.

`.SLDASM` montajdır. Parçalar tek tek seçilir. Montaj tek dosyada birleştirilmez.

## Sınama

```bash
npm test
```

`SLDPRT_ORNEK` bir klasörü gösterirse o klasördeki parçalar da sınanır.

```bash
SLDPRT_ORNEK="/yol/paket" npm test
```

Klasör yoksa bu sınamalar atlanır. Küp örneği ve üretilen OBJ her kurulumda çalışır.

## Lisans

ISC. Telif Talha Ubeyd Kılınç, 2026.

SolidWorks okuma [solidworks-converters](https://github.com/blussyya/solidworks-converters) ile yapılır. Bu paket Apache-2.0 lisansındadır. Ağ okuma assimpjs ile yapılır, lisansı MIT. CAD okuma occt-import-js ile yapılır, lisansı LGPL-2.1. Bu üç paket kendi lisanslarını taşır.
