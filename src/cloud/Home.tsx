/* Yeni görev: selamlama, yazma kutusu ve örnek istemler. */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Me } from './api';
import { Composer } from './Composer';
import { displayName } from './ui';

const EXAMPLES = ['40×30×20 mm kutu, kenarlar 2 mm yuvarlatılmış', 'Ø100 mm, 10 mm kalın, 6 cıvata delikli flanş', 'Ø25 × 60 mm boru, et kalınlığı 3 mm'];

export function Home({ me, onStart }: { me: Me | null; onStart: (p: string) => void }) {
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
