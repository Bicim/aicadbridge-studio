/* Entegrasyon kataloğu: hangi program/hizmet, hangi durumda, AICADBridge onunla ne yapar. Saf veri, arayüz yok. */
import type { HostId } from './api';

export type Status = 'ready' | 'beta' | 'folder' | 'soon';
export type Special = 'mcp' | 'apikeys';

export interface Entry {
  /** Oylama anahtarı (^[a-z0-9_]{1,40}$). Ana bilgisayar girdilerinde host kimliğiyle aynı. */
  id: string;
  name: string;
  desc: string;
  status: Status;
  /** Bu girdiyi karşılayan bağlayıcı; bağlı cihaz eşleşmesi bununla yapılır. */
  host?: HostId;
  /** Kart yerine sayfadaki bölüme götürür. */
  special?: Special;
  /** Elle kurulum zip'i (kurulum programı yerine). */
  manual?: { file: string; how: string };
}

export interface Category { id: string; title: string; entries: Entry[] }

export const SETUP_URL = 'https://github.com/Bicim/aicadbridge-connectors/releases/latest/download/AICADBridgeSetup.exe';

export const STATUS_LABEL: Record<Status, string> = { ready: 'Hazır', beta: 'Beta', folder: 'STEP klasörü', soon: 'Yakında' };

const FOLDER = 'Modeli STEP olarak klasöre bırakır, programda İçe aktar ile açarsın.';
const folder = (id: string, name: string, desc = FOLDER): Entry => ({ id, name, desc, status: 'folder', host: 'other' });
const soon = (id: string, name: string, desc: string): Entry => ({ id, name, desc, status: 'soon' });

export const CATALOG: Category[] = [
  {
    id: 'cad', title: 'CAD',
    entries: [
      soon('onshape', 'Onshape', 'Planlanan: üretilen modeli açık Onshape belgene parça olarak ekler.'),
      {
        id: 'fusion', name: 'Autodesk Fusion', status: 'ready', host: 'fusion',
        desc: "Modeli Fusion'da yeni bileşen olarak açar.",
        manual: { file: 'AICADBridgeLink-fusion.zip', how: 'Zip\'i aç, klasörü Fusion\'da Yardımcı Programlar → Eklentiler → + ile ekle ve çalıştır. Araç çubuğundaki "AICADBridge Bağlan" düğmesi bir kod gösterir.' },
      },
      folder('nx', 'Siemens NX'),
      { id: 'inventor', name: 'Autodesk Inventor', status: 'beta', host: 'inventor', desc: "Modeli Inventor'da yeni parça olarak açar." },
      {
        id: 'solidworks', name: 'SolidWorks', status: 'ready', host: 'solidworks',
        desc: "Modeli SolidWorks'te yeni parça olarak açar.",
        manual: { file: 'AICADBridgeLink-solidworks.zip', how: 'Zip\'i aç ve run.bat\'ı çalıştır (Python 3 gerekir). Ekranda çıkan kodu burada onayla. SolidWorks yoksa STEP dosyalarını ~/AICADBridge/inbox klasörüne kaydeder.' },
      },
      { id: 'solidedge', name: 'Solid Edge', status: 'beta', host: 'solidedge', desc: "Modeli Solid Edge'de yeni parça olarak açar." },
      { id: 'autocad', name: 'AutoCAD', status: 'beta', host: 'autocad', desc: 'Modeli açık çizime 3B katı nesne olarak ekler.' },
      { id: 'catia', name: 'CATIA V5', status: 'beta', host: 'catia', desc: "Modeli CATIA V5'te yeni parça olarak açar." },
      soon('catia_3dx', 'CATIA 3DEXPERIENCE', 'Planlanan: modeli 3DEXPERIENCE platformuna parça olarak gönderir.'),
      soon('revit', 'Revit', 'Planlanan: modeli Revit projesine aile geometrisi olarak yerleştirir.'),
      { id: 'rhino', name: 'Rhino 8', status: 'beta', host: 'rhino', desc: "Modeli Rhino'ya katı nesne olarak ekler." },
      folder('creo', 'PTC Creo'),
      soon('mcmaster', 'McMaster-Carr', 'Planlanan: tarifine uyan standart bağlantı elemanını katalogdan bulup modele ekler.'),
    ],
  },
  {
    id: 'cae', title: 'CAE',
    entries: [
      folder('ansys', 'Ansys', 'Modeli STEP olarak bırakır; Ansys\'te geometri olarak içe aktarıp analize geçersin.'),
      folder('abaqus', 'Abaqus/CAE', 'Modeli STEP olarak bırakır; Abaqus\'te parça olarak içe aktarırsın.'),
      folder('comsol', 'COMSOL Multiphysics', 'Modeli STEP olarak bırakır; COMSOL\'da geometri düğümüyle içe aktarırsın.'),
      folder('starccm', 'Simcenter STAR-CCM+', 'Modeli STEP olarak bırakır; STAR-CCM+\'ta 3B-CAD modeli olarak içe aktarırsın.'),
      folder('hypermesh', 'Altair HyperMesh', 'Modeli STEP olarak bırakır; HyperMesh\'te geometri olarak içe aktarıp ağ örersin.'),
    ],
  },
  {
    id: 'ecad', title: 'ECAD',
    entries: [
      soon('kicad', 'KiCad', 'Planlanan: kart ölçüsünden gövde ve montaj deliklerini üretip kart tasarımına gönderir.'),
      soon('altium', 'Altium Designer', 'Planlanan: üretilen muhafaza modelini kart tasarımına mekanik katman olarak ekler.'),
    ],
  },
  {
    id: 'plm', title: 'PLM',
    entries: [
      soon('arena', 'Arena', 'Planlanan: onayladığın modeli ürün kaydına yeni revizyon olarak ekler.'),
      soon('teamcenter', 'Teamcenter', 'Planlanan: modeli Teamcenter kasasına parça revizyonu olarak yükler.'),
      soon('windchill', 'Windchill', 'Planlanan: modeli Windchill\'de yeni CAD belgesi olarak kaydeder.'),
      soon('solidworks_pdm', 'SOLIDWORKS PDM', 'Planlanan: üretilen parçayı PDM kasasına girer ve sürümler.'),
    ],
  },
  {
    id: 'custom', title: 'Özel bağlantılar',
    entries: [
      { id: 'mcp', name: 'MCP sunucusu', status: 'ready', special: 'mcp', desc: 'Claude, Cursor veya VS Code gibi bir asistandan AICADBridge ile model kurdurur.' },
      { id: 'apikeys', name: 'API anahtarları', status: 'ready', special: 'apikeys', desc: 'Kendi betiğin veya asistanın için kişisel anahtar oluşturur.' },
    ],
  },
  {
    id: 'productivity', title: 'Verimlilik',
    entries: [
      soon('gmail', 'Gmail', 'Planlanan: gelen e-postadaki ölçü ve istekten model taslağı çıkarır.'),
      soon('outlook', 'Outlook', 'Planlanan: e-posta eklerindeki teknik isteği modele çevirir.'),
      soon('notion', 'Notion', 'Planlanan: modelin önizlemesini ve ölçü tablosunu bir Notion sayfasına ekler.'),
      soon('gdrive', 'Google Drive', 'Planlanan: üretilen STEP ve GLB dosyalarını seçtiğin klasöre yedekler.'),
      soon('gsheets', 'Google Sheets', 'Planlanan: tablodaki satırlardan parametreli model varyantları üretir.'),
      soon('airtable', 'Airtable', 'Planlanan: kayıtlardaki ölçülerle parça listesi modellerini üretir.'),
      soon('dropbox', 'Dropbox', 'Planlanan: model dosyalarını Dropbox klasörüne otomatik kaydeder.'),
      soon('coda', 'Coda', 'Planlanan: model önizlemesini ve parametrelerini Coda belgene yerleştirir.'),
    ],
  },
  {
    id: 'creative', title: 'Yaratıcı',
    entries: [
      {
        id: 'blender', name: 'Blender', status: 'ready', host: 'blender',
        desc: 'Modeli Blender sahnesine ağ nesnesi olarak ekler.',
        manual: { file: 'aicadbridge_link-blender.zip', how: 'Düzen → Tercihler → Eklentiler → Diskten yükle ile zip\'i seç. Görünüm penceresinde N paneli → AICADBridge → Bağlan.' },
      },
      soon('unreal', 'Unreal Engine', 'Planlanan: modeli projene statik mesh olarak aktarır.'),
      soon('sketchup', 'SketchUp', 'Planlanan: modeli SketchUp sahnesine bileşen olarak yerleştirir.'),
    ],
  },
  {
    id: 'design', title: 'Tasarım',
    entries: [
      soon('figma', 'Figma', 'Planlanan: modelin görünümlerini tasarım dosyana görsel olarak ekler.'),
      soon('canva', 'Canva', 'Planlanan: model önizlemesini sunum ve afişlere görsel olarak ekler.'),
    ],
  },
  {
    id: 'meeting', title: 'Toplantı',
    entries: [
      soon('gcal', 'Google Takvim', 'Planlanan: tasarım gözden geçirme toplantılarını modelle birlikte takvime koyar.'),
      soon('zoom', 'Zoom', 'Planlanan: toplantı sırasında modeli paylaşılabilir bağlantıyla açar.'),
      soon('teams', 'Microsoft Teams', 'Planlanan: model önizlemesini kanala gönderir.'),
      soon('calendly', 'Calendly', 'Planlanan: müşteriye model bağlantısı ve randevu daveti birlikte gönderir.'),
      soon('calcom', 'Cal.com', 'Planlanan: randevu davetine model önizlemesini ekler.'),
      soon('webex', 'Webex', 'Planlanan: görüşmede modeli paylaşılabilir bağlantıyla açar.'),
    ],
  },
  {
    id: 'project', title: 'Proje',
    entries: [
      soon('asana', 'Asana', 'Planlanan: üretilen modeli görev kartına önizleme ve dosya olarak ekler.'),
      soon('basecamp', 'Basecamp', 'Planlanan: model sürümlerini proje akışına not olarak ekler.'),
    ],
  },
  {
    id: 'crm', title: 'CRM',
    entries: [
      soon('hubspot', 'HubSpot', 'Planlanan: teklif kaydına model önizlemesi ve ölçüleri ekler.'),
      soon('intercom', 'Intercom', 'Planlanan: destek yazışmasındaki parça isteğinden model üretir.'),
      soon('typeform', 'Typeform', 'Planlanan: form yanıtındaki ölçülerden otomatik model üretir.'),
    ],
  },
  {
    id: 'finance', title: 'Finans',
    entries: [
      soon('quickbooks', 'QuickBooks', 'Planlanan: modelden çıkan malzeme ve süre bilgisiyle teklif kalemi hazırlar.'),
      soon('ramp', 'Ramp', 'Planlanan: parça listesindeki kalemlerden satın alma talebi taslağı çıkarır.'),
    ],
  },
];

export const ALL_ENTRIES: Entry[] = CATALOG.flatMap((c) => c.entries);

/** Cihaz listesi ve görev ekranı için bağlayıcı adları. */
export const HOST_LABEL: Record<HostId, string> = {
  fusion: 'Autodesk Fusion', blender: 'Blender', solidworks: 'SolidWorks', inventor: 'Autodesk Inventor',
  solidedge: 'Solid Edge', catia: 'CATIA V5', autocad: 'AutoCAD', rhino: 'Rhino 8', other: 'STEP klasörü',
};

/** Katalog girdisinden iki harfli simge (adın ilk iki harf/rakamı; çok sözcükte baş harfler). */
export function monogram(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const s = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
  return s.toLocaleUpperCase('tr-TR');
}

/** Girdiye özgü sabit renk tonu. */
export function monoHue(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function matches(e: Entry, categoryTitle: string, q: string): boolean {
  const n = q.trim().toLocaleLowerCase('tr-TR');
  if (!n) return true;
  return `${e.name} ${e.desc} ${categoryTitle} ${STATUS_LABEL[e.status]}`.toLocaleLowerCase('tr-TR').includes(n);
}
