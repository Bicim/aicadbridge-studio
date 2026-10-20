/* ============================================================
   types.ts - Plan ve ModelIR sözleşmeleri
   AICADBridge'in Fusion tarafındaki mimarisinin web karşılığı:
   Planner -> Plan JSON -> Coder -> ModelIR (geometri ara temsili)
   -> Executor (three.js + CSG). Birim: mm. Eksen: Y yukarı.
   ============================================================ */

/** Sayı ya da parametreler üzerinden ifade: "cap/2 - duvar" */
export type Expr = number | string;

export interface BoxNode {
  op: 'box';
  size: [Expr, Expr, Expr]; // [genişlik(x), yükseklik(y), derinlik(z)], merkezde
}

export interface CylinderNode {
  op: 'cylinder';
  radius: Expr;
  height: Expr;
  segments?: number; // $fn karşılığı, varsayılan 48
}

export interface SphereNode {
  op: 'sphere';
  radius: Expr;
  segments?: number;
}

export interface ConeNode {
  op: 'cone';
  radiusBottom: Expr;
  radiusTop: Expr;
  height: Expr;
  segments?: number;
}

export interface TorusNode {
  op: 'torus';
  radius: Expr; // ana yarıçap
  tube: Expr; // tüp yarıçapı
  segments?: number; // tüp boyunca (varsayılan 64)
  radialSegments?: number; // kesit (varsayılan 24)
}

export type PrimitiveNode = BoxNode | CylinderNode | SphereNode | ConeNode | TorusNode;

export interface TranslateNode {
  op: 'translate';
  offset: [Expr, Expr, Expr];
  children: IrNode[];
}

/** Derece cinsinden Euler açıları, uygulanma sırası XYZ */
export interface RotateNode {
  op: 'rotate';
  euler: [Expr, Expr, Expr];
  children: IrNode[];
}

export interface MirrorNode {
  op: 'mirror';
  axis: 'x' | 'y' | 'z';
  children: IrNode[];
}

export type BooleanOp = 'union' | 'difference' | 'intersection';

export interface BooleanNode {
  op: BooleanOp;
  children: IrNode[]; // difference: soldan sağa; ilk çocuk taban
}

export interface RectPatternNode {
  op: 'pattern_rect';
  count: Expr;
  step: [Expr, Expr, Expr]; // her kopya arası öteleme
  children: IrNode[];
}

export interface CircPatternNode {
  op: 'pattern_circular';
  count: Expr;
  radius: Expr;
  axis?: 'x' | 'y' | 'z'; // döngü ekseni (delik çemberi için 'y')
  startAngle?: Expr; // derece, varsayılan 0
  children: IrNode[]; // genellikle origin çevresinde bir delik
}

export interface ColorNode {
  op: 'color';
  color: string; // '#RRGGBB' ya da CSS adı
  children: IrNode[];
}

export type IrNode =
  | PrimitiveNode
  | TranslateNode
  | RotateNode
  | MirrorNode
  | BooleanNode
  | RectPatternNode
  | CircPatternNode
  | ColorNode;

/** Kaydırıcı panelini besleyen parametre tanımı */
export interface ParameterDef {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  desc?: string;
}

/** Modelin ara temsili: parametreler + parça listesi */
export interface ModelIR {
  name: string;
  units?: 'mm';
  parameters: Record<string, ParameterDef>;
  /** Üst düzey parçalar. Kökte color -> ayrı renkli mesh olarak çizilir. */
  body: IrNode[];
}

/* ---------------- Plan (Planner çıktısı) ---------------- */

export interface PlanStep {
  feature: string; // kısa özellik anahtarı, örn "govde", "delikler"
  description: string; // ne yapılacağı, ölçülerle
}

export interface Plan {
  name: string;
  description?: string;
  parameters: Record<string, ParameterDef>;
  steps: PlanStep[];
  /** Geometrik doğrulama beklentileri (Self-Healing bunları kullanır) */
  expectations?: {
    bbox_mm?: [number, number, number];
    min_volume_mm3?: number;
    parts?: number;
  };
}

/* ---------------- Yürütme sonuçları ---------------- */

export interface ExecutedPart {
  geometry: import('three').BufferGeometry;
  color?: string;
}

export interface ExecStats {
  bbox: [number, number, number];
  volume: number; // mm^3 (toplam)
  triangles: number;
  parts: number;
}

export interface ExecutionResult {
  parts: ExecutedPart[];
  stats: ExecStats;
}

/* ---------------- Kayıtlar ---------------- */

export type Stage = 'plan' | 'code' | 'execute' | 'verify' | 'heal' | 'done' | 'error';

export interface LogEntry {
  stage: Stage;
  message: string;
  ok?: boolean;
}
