/* Logo karosu: 40px, yarıçap 10px, --surface-2 zemin, logo 24px ortada.
   Logo yalnız dosyası varsa istenir (LOGOS); yoksa, yüklenemezse ya da küçük karoda okunmayan bir yazı logosuysa
   marka rengiyle renklendirilmiş harf simgesine düşer. Yazı logosu yalnız büyük karoda (ayrıntı penceresi) gösterilir. */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { LOGOS } from './logos';

/** Addan iki harfli simge (adın ilk iki harf/rakamı; çok sözcükte baş harfler). */
export function monogram(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const s = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
  return s.toLocaleUpperCase('tr-TR');
}

export function LogoTile({ id, name, size = 40, icon }: { id: string; name: string; size?: 32 | 40 | 48; icon?: ReactNode }) {
  const [broken, setBroken] = useState(false);
  const meta = icon ? undefined : LOGOS[id];
  const wordmark = meta?.shape === 'wordmark';
  const show = !!meta && !broken && (!wordmark || size === 48);
  const px = size === 32 ? 20 : size === 48 ? 30 : 24;
  const cls = ['c-tile', size === 40 ? '' : `s${size}`, show && meta?.fill ? 'fill' : '', show && wordmark ? 'wordmark' : ''].filter(Boolean).join(' ');
  const style = meta?.color ? ({ '--brand': meta.color } as CSSProperties) : undefined;
  return (
    <span className={cls} style={style} aria-hidden="true">
      {icon ?? (show
        ? <img src={`${import.meta.env.BASE_URL}logos/${id}.svg`} alt="" loading="lazy" decoding="async"
            width={wordmark ? 132 : px} height={wordmark ? 48 : px}
            className={meta?.tone ? `tone-${meta.tone}` : undefined} onError={() => setBroken(true)} />
        : <span className="c-tile-mono">{monogram(name)}</span>)}
    </span>
  );
}
