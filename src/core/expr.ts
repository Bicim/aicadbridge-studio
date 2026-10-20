/* ============================================================
   expr.ts - parametreler üzerinden güvenli ifade değerlendirici
   "cap/2 - duvar" gibi dizgiler. Sandık dışına çıkış yok:
   yalnız sayılar, tanımlı parametre adları, + - * / ( ) ve
   tek terimli eksi. Bilinmeyen ad / sözdizimi hatası ->
   açıklayıcı Error (Self-Healing bu metni modele geri verir).
   ============================================================ */

type Token = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

import type { Expr } from './types';

const OPERATORS = new Set(['+', '-', '*', '/', '(', ')']);

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const text = src.slice(i, j);
      if ((text.match(/\./g) || []).length > 1) throw new Error(`Geçersiz sayı: "${text}"`);
      tokens.push({ t: 'num', v: parseFloat(text) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (OPERATORS.has(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
    throw new Error(`İfadede beklenmeyen karakter: "${ch}" ("${src}")`);
  }
  return tokens;
}

/** Özyinelemeli iniş: expr = term (('+'|'-') term)* */
export function evalExpr(src: string | number, vars: Record<string, number>): number {
  if (typeof src === 'number') return src;
  const tokens = tokenize(src);
  let pos = 0;

  const peek = () => tokens[pos];
  const eat = (v: string) => {
    const tk = tokens[pos];
    if (!tk || tk.t !== 'op' || tk.v !== v) throw new Error(`"${src}" ifadesinde "${v}" bekleniyordu`);
    pos++;
  };

  function parsePrimary(): number {
    const tk = tokens[pos];
    if (!tk) throw new Error(`"${src}" ifadesi yarıda kesildi`);
    if (tk.t === 'num') { pos++; return tk.v; }
    if (tk.t === 'id') {
      pos++;
      if (!(tk.v in vars)) throw new Error(`Tanımsız parametre "${tk.v}" ("${src}")`);
      return vars[tk.v];
    }
    if (tk.t === 'op' && tk.v === '(') {
      eat('(');
      const v = parseSum();
      eat(')');
      return v;
    }
    if (tk.t === 'op' && tk.v === '-') {
      eat('-');
      return -parsePrimary();
    }
    throw new Error(`"${src}" ifadesinde beklenmeyen simge: "${tk.v}"`);
  }

  function parseProduct(): number {
    let v = parsePrimary();
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = tokens[pos++].v as string;
      const rhs = parsePrimary();
      if (op === '*') v *= rhs;
      else {
        if (rhs === 0) throw new Error(`"${src}" ifadesinde sıfıra bölme`);
        v /= rhs;
      }
    }
    return v;
  }

  function parseSum(): number {
    let v = parseProduct();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = tokens[pos++].v as string;
      const rhs = parseProduct();
      if (op === '+') v += rhs;
      else v -= rhs;
    }
    return v;
  }

  const result = parseSum();
  if (pos !== tokens.length) throw new Error(`"${src}" ifadesinde fazladan simge: "${tokens[pos].v}"`);
  if (!Number.isFinite(result)) throw new Error(`"${src}" ifadesi sonlu bir sayı vermedi`);
  return result;
}

/** Expr değerini parametre sözlüğüyle çözer; sayıysa olduğu gibi döner. */
export function resolve(expr: Expr, vars: Record<string, number>): number {
  return evalExpr(expr, vars);
}

export function resolveVec3(vec: [Expr, Expr, Expr], vars: Record<string, number>): [number, number, number] {
  return [resolve(vec[0], vars), resolve(vec[1], vars), resolve(vec[2], vars)];
}
