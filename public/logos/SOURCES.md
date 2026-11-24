# Logo kaynakları / Logo sources

Bu klasör AICADBridge'in entegre olduğu uygulamaların orijinal marka logolarını içerir. `manifest.json` her anahtar için dosya, PNG, tür (`full-color` | `simple-icons` | `vendor`), kaynak URL, lisans ve bayt boyutunu listeler. Eksik anahtarlar için dosya yoktur (arayüz monogram kullanır).

SVG'ler temizlendi (script/foreignObject/olay öznitelikleri/harici href/metadata kaldırıldı), viewBox kareye ortalanarak genişletildi ve küçültüldü. Bazı logolar (Inventor, Creo) ikon+yazı logosundan yalnızca ikon kısmına kırpıldı; `#ededef` dolgulu Simple Icons logoları koyu arayüz içindir (beyaz zeminde görünmez). `shape` = icon | wordmark (wordmark 24 px'te okunmaz); `color` = koyu arayüzde okunur marka rengi (monogram için). Simple Icons koyu marka rengi koyu arka planda zayıfsa `#ededef` kullanıldı.

| Key | Kind / shape | Source | License | Note |
|---|---|---|---|---|
| abaqus | vendor / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/dassaultsystemes.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner | Dassault Systemes mark (no Abaqus product icon found) |
| airtable | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/airtable.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| altium | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/altiumdesigner.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| ansys | simple-icons / wordmark | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/ansys.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner | wordmark |
| arena | full-color / icon | https://www.arenasolutions.com/wp-content/uploads/cropped-arena-favicon-500x500-1-248x248.png | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | vendor website icon |
| asana | full-color / icon | https://svgl.app/library/asana-logo.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| autocad | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/autocad.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| basecamp | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/basecamp.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| blender | full-color / icon | https://svgl.app/library/blender.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| calcom | full-color / icon | https://cal.com/icon.png | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | vendor website icon |
| calendly | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/calendly.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| canva | full-color / icon | https://svgl.app/library/canva.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| catia | vendor / icon | https://www.3ds.com/asset/img/favicon/apple/apple-touch-icon-180x180.png | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | Dassault Systemes (3DS) mark from 3ds.com; no CATIA product icon reachable |
| catia_3dx | vendor / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/dassaultsystemes.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner | Dassault Systemes mark (no 3DEXPERIENCE product icon found) |
| coda | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/coda.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| comsol | full-color / icon | https://www.comsol.com/images/favicon.ico | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | vendor website favicon (64px source) |
| creo | full-color / icon | https://commons.wikimedia.org/wiki/File:PTC_Creo_logo.svg | Public domain (Wikimedia Commons; trademark of its owner) | cube mark cropped from cube+wordmark logo |
| dropbox | full-color / icon | https://svgl.app/library/dropbox.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| figma | full-color / icon | https://svgl.app/library/figma.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| fusion | full-color / icon | https://commons.wikimedia.org/wiki/File:Fusion360_Logo.svg | Public domain (Wikimedia Commons; trademark of its owner) | Autodesk Fusion app icon |
| gcal | full-color / icon | https://svgl.app/library/google-calendar.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| gdrive | full-color / icon | https://svgl.app/library/drive.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| gmail | full-color / icon | https://svgl.app/library/gmail.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| gsheets | full-color / icon | https://svgl.app/library/google-sheets.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| hubspot | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/hubspot.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| hypermesh | vendor / icon | https://www.siemens.com/_static/favicon.svg | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | Siemens square mark (no Altair HyperMesh (Altair is now part of Siemens) product icon found) |
| intercom | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/intercom.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| inventor | full-color / icon | https://commons.wikimedia.org/wiki/File:Autodesk_Inventor_Logo.svg | Public domain (Wikimedia Commons; trademark of its owner) | icon cropped from icon+wordmark logo |
| kicad | full-color / icon | https://www.kicad.org/apple-touch-icon-180x180.png | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | vendor website icon |
| mcmaster | full-color / icon | https://www.mcmaster.com/init/gfx/favicon/192x192.png | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | vendor website icon |
| notion | full-color / icon | https://svgl.app/library/notion.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| nx | vendor / icon | https://www.siemens.com/_static/favicon.svg | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | Siemens square mark (no NX product icon found) |
| onshape | full-color / icon | https://www.onshape.com/cdn-images/f35a61ea6bddcaa17307207813b50aaf8d6b846d-180x180.png | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | vendor website icon |
| outlook | full-color / icon | https://svgl.app/library/microsoft-outlook.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| quickbooks | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/quickbooks.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| ramp | full-color / icon | https://ramp.com/apple-touch-icon.png | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | vendor website icon |
| revit | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/autodeskrevit.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| rhino | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/rhinoceros.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| sketchup | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/sketchup.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| solidedge | full-color / icon | https://commons.wikimedia.org/wiki/File:Solid_Edge_Logo.svg | Public domain (Wikimedia Commons; trademark of its owner) |  |
| solidworks | full-color / wordmark | https://commons.wikimedia.org/wiki/File:SOLIDWORKS_Logo.svg | Public domain (Wikimedia Commons; trademark of its owner) | wordmark only (no icon found) |
| solidworks_pdm | vendor / wordmark | https://commons.wikimedia.org/wiki/File:SOLIDWORKS_Logo.svg | Public domain (Wikimedia Commons; trademark of its owner) | SOLIDWORKS wordmark (no PDM-specific icon) |
| starccm | vendor / icon | https://www.siemens.com/_static/favicon.svg | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | Siemens square mark (no Simcenter STAR-CCM+ product icon found) |
| teamcenter | vendor / icon | https://www.siemens.com/_static/favicon.svg | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | Siemens square mark (no Teamcenter product icon found) |
| teams | full-color / icon | https://svgl.app/library/microsoft-teams.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| typeform | full-color / icon | https://cdn.prod.website-files.com/66ffe2174aa8e8d5661c2708/68b6f00951eb33cd19b77288_Frame%201867174.png | Vendor website icon (favicon/apple-touch-icon); trademark of its owner, used nominatively | vendor website icon |
| unreal | full-color / icon | https://svgl.app/library/unreal_engine_dark.svg | Trademark of its owner; logo file from svgl.app library (nominative use) | dark-background variant (white mark) |
| webex | simple-icons / icon | https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/webex.svg | CC0-1.0 (Simple Icons); brand is a trademark of its owner |  |
| zoom | full-color / icon | https://svgl.app/library/zoom.svg | Trademark of its owner; logo file from svgl.app library (nominative use) |  |
| windchill | missing | - | - | no square icon obtainable: ptc.com / support.ptc.com return HTTP 403 to automated clients, PTC mark on Commons blocked by HTTP 429 |

## Kaynak türleri
- full-color: svgl.app kütüphanesi veya Wikimedia Commons'taki resmi renkli ürün logosu.
- simple-icons: Simple Icons (CC0 SVG yolları), marka renginde.
- vendor-site icon: üreticinin web sitesindeki favicon/apple-touch-icon (ör. onshape, mcmaster, ramp, arena, kicad, calcom, typeform, comsol); PNG ise `<image>` içinde base64 data URI olarak sarılmış kare SVG'dir.
- vendor: ürün ikonu bulunamadığında üretici/şirket işareti (ör. Siemens, Dassault Systèmes, Altair, PTC).

## Ticari marka bildirimi / Trademark notice
Ürün adları ve logolar sahiplerinin ticari markalarıdır; yalnızca uyumluluğu belirtmek için kullanılır, ortaklık veya onay anlamına gelmez. / Product names and logos are trademarks of their respective owners; used only to indicate compatibility, no endorsement implied.
