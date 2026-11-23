/* Bağlayıcı (eklenti) kimlikleri: cihaz listesi ve görev ekranı için adlar. Katalog kimlikleriyle aynıdır. */
import type { HostId } from './api';

export const HOST_LABEL: Record<HostId, string> = {
  fusion: 'Autodesk Fusion', blender: 'Blender', solidworks: 'SolidWorks', inventor: 'Autodesk Inventor',
  solidedge: 'Solid Edge', catia: 'CATIA V5', autocad: 'AutoCAD', rhino: 'Rhino 8', other: 'STEP klasörü',
};

export const hostLabel = (h: string) => HOST_LABEL[h as HostId] ?? h;

/** Son 90 sn içinde görülen bağlayıcı çevrimiçi sayılır (sunucu "online" gönderiyorsa o geçerli). */
const ONLINE_MS = 90_000;
export const isOnline = (d: { online?: boolean; last_seen: string | null }) =>
  d.online ?? (d.last_seen ? Date.now() - new Date(d.last_seen).getTime() < ONLINE_MS : false);
