/* ============================================================
   Sliders.tsx - parametrik kaydırıcı paneli
   Değer değişince App, IR'ı yeni değerlerle yeniden çalıştırır;
   model canlı güncellenir (CADAM Customizer panelinin karşılığı).
   ============================================================ */

import type { SliderSpec } from '../core/parameters';

interface Props {
  specs: SliderSpec[];
  values: Record<string, number>;
  onChange: (name: string, value: number) => void;
  onReset: () => void;
}

export function Sliders({ specs, values, onChange, onReset }: Props) {
  if (specs.length === 0) return null;
  return (
    <div className="sliders">
      <div className="sliders__head">
        <span className="sliders__title">Parametreler</span>
        <button className="btn btn--ghost btn--sm" onClick={onReset}>Sıfırla</button>
      </div>
      {specs.map((spec) => (
        <label className="slider" key={spec.name}>
          <span className="slider__label">
            <span className="slider__name">{spec.name}</span>
            <span className="slider__value">{values[spec.name] ?? spec.value}</span>
          </span>
          <input
            type="range"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={values[spec.name] ?? spec.value}
            onChange={(e) => onChange(spec.name, parseFloat(e.target.value))}
          />
          {spec.desc ? <span className="slider__desc">{spec.desc}</span> : null}
        </label>
      ))}
    </div>
  );
}
