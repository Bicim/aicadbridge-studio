/* Küçük ortak arayüz parçaları. */
import { useState } from 'react';
import type { Me } from './api';

export function Avatar({ me }: { me: Me | null }) {
  const [broken, setBroken] = useState(false);
  if (me?.avatar_url && !broken) {
    return <img className="c-avatar-s" src={me.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="c-avatar-s">{(me?.name || me?.email || '?').slice(0, 2).toUpperCase()}</span>;
}
