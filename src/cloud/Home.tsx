/* Yeni görev: selamlama, yazma kutusu ve örnek istemler. */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Me } from './api';
import { Composer, type SendOptions } from './Composer';
import { displayName } from './ui';

const EXAMPLES = [
  'Kabartmalı seramik kahve kupası, ergonomik kulplu',
  '12V-32V boost konvertör modülü ve soğutuculu kasası',
  'Ø100 mm, 6× M6 havşalı delikli, göbekli flanş',
];

export function Home({ me, onStart }: { me: Me | null; onStart: (p: string, opts?: SendOptions) => void }) {
  const [pick, setPick] = useState('');
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  const name = (me?.name?.split(' ')[0]) || displayName(me);
  return (
    <div className="c-home">
      <h1>{greet}{name ? `, ${name}` : ''}</h1>
      <p className="c-home-sub">Parçayı ve ölçülerini yaz; parametrik katıyı biz kuralım.</p>
      <Composer me={me} busy={false} onSend={onStart} label="Yeni görev" placeholder="Ne tasarlayalım? Parçayı ve ölçülerini yaz…" initial={pick} />
      <div className="c-examples" aria-label="Örnek istemler">
        {EXAMPLES.map((e) => <button key={e} type="button" className="c-chip" onClick={() => setPick(e)}><Sparkles aria-hidden="true" />{e}</button>)}
      </div>
    </div>
  );
}
