/* scripts/sync-logos.mjs tarafından üretildi; elle düzenleme. Kaynak/lisans: public/logos/SOURCES.md */
export interface LogoMeta {
  /** icon: karoda gösterilir; wordmark: küçük karoda okunmaz, yalnız büyük yerde (ayrıntı penceresi) gösterilir. */
  shape: 'icon' | 'wordmark';
  /** Koyu arayüzde okunur marka rengi (harf simgesini renklendirir). */
  color?: string;
  /** Tek renkli işaret: 'light' açık temada, 'dark' koyu temada ters çevrilir. */
  tone?: 'light' | 'dark';
  /** Kendi opak karosuyla gelen simge: karonun tamamını kaplar. */
  fill?: boolean;
}
/** public/logos/ içinde SVG'si olan katalog kimlikleri; listede olmayanlar harf simgesine düşer (eksik dosya istenmez). */
export const LOGOS: Readonly<Record<string, LogoMeta>> = {
  abaqus: {"shape":"icon","color":"#3f8fd0"},
  airtable: {"shape":"icon","color":"#18bfff"},
  altium: {"shape":"icon","color":"#c8b07a"},
  ansys: {"shape":"wordmark","color":"#ffb71b"},
  arena: {"shape":"icon","color":"#6cbe45"},
  asana: {"shape":"icon","color":"#f06a6a"},
  autocad: {"shape":"icon","color":"#e51050"},
  basecamp: {"shape":"icon","color":"#5ecc62","tone":"light"},
  blender: {"shape":"icon","color":"#e87d0d"},
  calcom: {"shape":"icon","color":"#ededef","fill":true},
  calendly: {"shape":"icon","color":"#006bff"},
  canva: {"shape":"icon","color":"#00c4cc"},
  catia: {"shape":"icon","color":"#6c76e0"},
  catia_3dx: {"shape":"icon","color":"#3f8fd0"},
  coda: {"shape":"icon","color":"#f46a54"},
  comsol: {"shape":"icon","color":"#368ccb"},
  creo: {"shape":"icon","color":"#6abf4b"},
  dropbox: {"shape":"icon","color":"#0061ff"},
  figma: {"shape":"icon","color":"#f24e1e"},
  fusion: {"shape":"icon","color":"#ff6a00"},
  gcal: {"shape":"icon","color":"#4285f4"},
  gdrive: {"shape":"icon","color":"#1fa463"},
  gmail: {"shape":"icon","color":"#ea4335"},
  gsheets: {"shape":"icon","color":"#34a853"},
  hubspot: {"shape":"icon","color":"#ff7a59"},
  hypermesh: {"shape":"icon","color":"#009999"},
  intercom: {"shape":"icon","color":"#6afdef"},
  inventor: {"shape":"icon","color":"#e5b800"},
  kicad: {"shape":"icon","color":"#4a6fd8","fill":true},
  mcmaster: {"shape":"icon","color":"#fcd116","fill":true},
  notion: {"shape":"icon","color":"#ededef"},
  nx: {"shape":"icon","color":"#009999"},
  onshape: {"shape":"icon","color":"#66b845","fill":true},
  outlook: {"shape":"icon","color":"#0a78d4"},
  quickbooks: {"shape":"icon","color":"#2ca01c"},
  ramp: {"shape":"icon","color":"#e4f222"},
  revit: {"shape":"icon","color":"#186bff"},
  rhino: {"shape":"icon","color":"#d04545","tone":"light"},
  sketchup: {"shape":"icon","color":"#1e88d0"},
  solidedge: {"shape":"icon","color":"#3a6fd8"},
  solidworks: {"shape":"wordmark","color":"#e0362d"},
  solidworks_pdm: {"shape":"wordmark","color":"#e0362d"},
  starccm: {"shape":"icon","color":"#009999"},
  teamcenter: {"shape":"icon","color":"#009999"},
  teams: {"shape":"icon","color":"#7b83eb"},
  typeform: {"shape":"icon","color":"#ededef","fill":true},
  unreal: {"shape":"icon","color":"#ededef","tone":"light"},
  webex: {"shape":"icon","color":"#00bceb","tone":"light"},
  zoom: {"shape":"icon","color":"#2d8cff"},
};
