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

## Kullanım

1. **⚙ Ayarlar** → sağlayıcı seç (OpenAI / Anthropic / Google / OpenRouter / OpenAI-uyumlu: DeepSeek, Ollama, LM Studio), API anahtarını gir, **Modelleri Listele** ya da model adını yaz.
2. Bir cümle yaz: *"100mm çapında flanş, çevresinde 4 adet M6 cıvata deliği"*
3. Planı, kodu (ModelIR) ve doğrulama raporunu izle; kaydırıcılarla oyna.
4. **STL / GLTF / JSON** olarak dışa aktar.

> Anahtar yalnızca `localStorage`'da tutulur; seçtiğin sağlayıcı dışına gönderilmez.

## Geliştirme

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # vitest: ifade değerlendirici, CSG çalıştırıcı, doğrulama, parametreler (33 test)
npm run build     # tsc + vite (dist/)
```

### Yapı

```
src/
  core/    types (Plan/ModelIR), expr (güvenli ifadeler), executor (CSG),
           volume, verify, parameters (slider), export (STL/GLTF/JSON)
  ai/      providers (çoklu sağlayıcı, tarayıcıdan), prompts (TR),
           pipeline (iki aşama + self-healing)
  ui/      Viewer (three.js), Sliders, SettingsDialog
  App.tsx  orkestrasyon
tests/     vitest
```

## Kısıtlar (v0.1.0)

- Fillet/chamfer yok (CSG motoru kavisli kenar desteklemez); basamaklı yaklaşım gerekir.
- Doğrulama sayısaldır; görsel (vision) denetim yol haritasında.
- segments 512+ önerilmez (tarayıcı performansı).

## Lisans

MIT · three.js (MIT) · three-bvh-csg (MIT)

Ürün repo'su: [Bicim/AICADBridge](https://github.com/Bicim/AICADBridge) · Tanıtım sitesi: [aicadbridge-web](https://github.com/Bicim/aicadbridge-web)
