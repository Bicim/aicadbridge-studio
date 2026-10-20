import { describe, expect, it } from 'vitest';
import { evalExpr } from '../src/core/expr';

describe('evalExpr', () => {
  const vars = { cap: 20, duvar: 2, yukseklik: 30 };

  it('sayıyı olduğu gibi döndürür', () => {
    expect(evalExpr(5, vars)).toBe(5);
    expect(evalExpr('7', vars)).toBe(7);
  });

  it('dört işlem ve parantez', () => {
    expect(evalExpr('cap / 2 - duvar', vars)).toBe(8);
    expect(evalExpr('(cap - 2 * duvar) / 2', vars)).toBe(8);
    expect(evalExpr('cap + yukseklik * 2', vars)).toBe(80);
  });

  it('tek terimli eksi', () => {
    expect(evalExpr('-cap', vars)).toBe(-20);
    expect(evalExpr('5 * -2', vars)).toBe(-10);
  });

  it('ondalık sayılar', () => {
    expect(evalExpr('1.5 * 2', vars)).toBe(3);
    expect(evalExpr('cap * 0.5', vars)).toBe(10);
  });

  it('tanımsız parametre hatası', () => {
    expect(() => evalExpr('bilinmeyen + 1', vars)).toThrow(/Tanımsız parametre/);
  });

  it('sıfıra bölme hatası', () => {
    expect(() => evalExpr('cap / 0', vars)).toThrow(/sıfıra bölme/);
  });

  it('beklenmeyen karakter hatası', () => {
    expect(() => evalExpr('cap ^ 2', vars)).toThrow(/beklenmeyen karakter/);
  });

  it('yarıda kesilme hatası', () => {
    expect(() => evalExpr('(cap + 1', vars)).toThrow();
  });

  it('fazladan simge hatası', () => {
    expect(() => evalExpr('cap 5', vars)).toThrow();
  });
});
