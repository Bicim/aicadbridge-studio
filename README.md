# AICADBridge Web Studio

Tarayıcıda çalışan **text-to-CAD**: bir cümle yaz, Planner planı çıkarsın, Coder geometriyi kursun, model burada canlı görünsün. [AICADBridge](https://github.com/Bicim/AICADBridge) (Fusion 360 eklentisi) projesinin web kardeşi.

**Canlı:** https://bicim.github.io/aicadbridge-studio/

## Nasıl çalışır

Fusion eklentisindeki mimarinin birebir web karşılığı (backend yok, tamamen istemci tarafı):

```
Cümle ──▶ PLANNER (niyet → plan JSON: adımlar, parametreler, beklentiler)
      ──▶ CODER (plan → ModelIR: geometri ara temsili, JSON)
      ──▶ EXECUTOR (ModelIR + parametreler → three.js + CSG → mesh)
      ──▶ VERIFY (ölçüler/hacim/parça sayısı vs plan beklentileri)
      └─ sorun varsa ▶ HEALER (en fazla 3 deneme: hatayı oku, IR'ı düzelt)
```

- **ModelIR**: kendi geometri ara temsilimiz. İlkel (box, cylinder, sphere, cone, torus), boolean (union/difference/intersection), dönüşüm (translate/rotate/mirror) ve desenler (`pattern_circular` cıvata deliği çemberleri için). Sayı alanlarında parametre ifadeleri: `"dis_cap/2 - duvar"`.
- **Parametrik**: Planner her ölçüyü min/max/step ile tanımlar; kaydırıcılar modeli anında yeniden kurar.
- **Self-healing**: çalıştırma hatası ya da doğrulama sapması modele geri verilir, IR düzeltilir (3 denemeye dek).
- **Doğrulama**: beklenti bbox/hacim/parça sayısı vs ölçülen (CADAM analizindeki "denetim sayfası" kavramının sayısal MVP karşılığı; görsel denetim yolda).
- **Üretilebilirlik denetimi (DfAM)**: [text-to-cad](https://github.com/earthtojake/text-to-cad) (MIT) projesinin DfAM sistemi portlanmıştır — model yerel olarak **ölçülür** (duvar kalınlığı ray-cast örneklemi, aşırı açı haritası, destek hacmi prizma üst sınırı, 6 kurulum yönü adayı, birim ölçeği ipucu, kenar-akışkan kapalılık) ve bulgular süreç limitleriyle (FDM / SLA / SLS / MJF / PBF-LB; Hubs, Formlabs, HP, EOS kılavuzları, ISO/ASTM 52910 çerçevesi) karşılaştırılır. Her bulgu ölçülen değeri, limiti ve kaynağı gösterir; her ihlal için sayılı yeniden tasarım talimatı üretir ve **AI'ya gönder** ile self-healing akışına geri verir.

## Kullanım

1. **⚙ Ayarlar** → sağlayıcı seç (OpenAI / Anthropic / Google / OpenRouter / OpenAI-uyumlu: DeepSeek, Ollama, LM Studio), API anahtarını gir, **Modelleri Listele** ya da model adını yaz.
2. Bir cümle yaz: *"100mm çapında flanş, çevresinde 4 adet M6 cıvata deliği"*
3. Planı, kodu (ModelIR) ve doğrulama raporunu izle; kaydırıcılarla oyna.
4. **Üretilebilirlik (DfAM)** panelinde süreci seç (varsayılan FDM) ve **Analiz et**'e bas; ❌ bulguları **AI'ya gönder** ile düzelttir.
5. **STL / 3MF / GLB / GLTF / JSON** olarak dışa aktar. STL ve 3MF dilimleyicilerin beklediği Z-yukarı düzeninde yazılır; 3MF parça başına renkli, mm birimli OPC paketidir (text-to-cad'ın dışa aktarma setinden).

> Anahtar yalnızca `localStorage`'da tutulur; seçtiğin sağlayıcı dışına gönderilmez.

## Geliştirme

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # vitest: ifade değerlendirici, CSG çalıştırıcı, doğrulama, parametreler, DfAM, 3MF (49 test)
npm run build     # tsc + vite (dist/)
```

### Yapı

```
src/
  core/    types (Plan/ModelIR), expr (güvenli ifadeler), executor (CSG),
           volume, verify, parameters (slider), dfam (üretilebilirlik),
           export (STL/3MF/GLB/GLTF/JSON)
  ai/      providers (çoklu sağlayıcı, tarayıcıdan), prompts (TR),
            pipeline (iki aşama + self-healing)
  ui/      Viewer (three.js), Sliders, DfamPanel, SettingsDialog
  App.tsx  orkestrasyon
tests/     vitest
```

## Kısıtlar (v0.1.0)

- Fillet/chamfer yok (CSG motoru kavisli kenar desteklemez); basamaklı yaklaşım gerekir.
- Doğrulama sayısaldır; görsel (vision) denetim yol haritasında.
- DfAM: delik çapı / pozitif detay / köprü limitleri henüz ölçülmez (text-to-cad'de de ölçülmez); toz süreçlerinde sıkışan toz tahliyesi kontrol edilmez. Duvar kalınlığı ray-cast örneklemidir (örneklenen asgari), 250 binden fazla üçgende atlanır. Kapanma testi T-eksem farkındalıklıdır: boolean CSG dikişlerindeki T-tepe noktalı ama geometrik olarak mühürlü yüzeyler kapalı sayılır (gerçek boşluklar ölçülür).
- segments 512+ önerilmez (tarayıcı performansı).

## Lisans

MIT · three.js (MIT) · three-bvh-csg (MIT) · three-mesh-bvh (MIT)

DfAM ölçüm yaklaşımı ve süreç limit tablosu [earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad) (MIT) projesinden uyarlanmıştır.

Ürün repo'su: [Bicim/AICADBridge](https://github.com/Bicim/AICADBridge) · Tanıtım sitesi: [aicadbridge-web](https://github.com/Bicim/aicadbridge-web)
