/**
 * Calculator tool: evaluates an arithmetic expression with a small
 * recursive-descent parser. No eval — only numbers, operators, parentheses,
 * the functions and constants listed below.
 */

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  min: Math.min, max: Math.max, pow: Math.pow,
  sum: (...a) => a.reduce((s, x) => s + x, 0),
  avg: (...a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN),
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Token = { type: 'num'; value: number } | { type: 'id'; value: string } | { type: 'op'; value: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c) || c === '_') { i++; continue; }
    const num = /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) {
      tokens.push({ type: 'num', value: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[a-zA-Z][a-zA-Z0-9]*/.exec(src.slice(i));
    if (id) {
      tokens.push({ type: 'id', value: id[0].toLowerCase() });
      i += id[0].length;
      continue;
    }
    if (src.startsWith('**', i)) { tokens.push({ type: 'op', value: '^' }); i += 2; continue; }
    if ('+-*/%^(),'.includes(c)) { tokens.push({ type: 'op', value: c }); i++; continue; }
    throw new Error(`Unexpected character "${c}" at position ${i + 1}`);
  }
  return tokens;
}

export function evaluate(expression: string): number {
  if (expression.length > 500) throw new Error('Expression is too long (500 characters max)');
  const tokens = tokenize(expression);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.type === 'op' && peek()!.value === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`Expected "${v}"`);
    pos++;
  };

  // expr := term (('+'|'-') term)*
  const expr = (): number => {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++].value;
      const right = term();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };
  // term := unary (('*'|'/'|'%') unary)*
  const term = (): number => {
    let left = unary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = tokens[pos++].value;
      const right = unary();
      left = op === '*' ? left * right : op === '/' ? left / right : left % right;
    }
    return left;
  };
  // unary := ('-'|'+') unary | power
  const unary = (): number => {
    if (isOp('-')) { pos++; return -unary(); }
    if (isOp('+')) { pos++; return unary(); }
    return power();
  };
  // power := primary ('^' unary)?   (right-associative)
  const power = (): number => {
    const base = primary();
    if (isOp('^')) { pos++; return Math.pow(base, unary()); }
    return base;
  };
  const primary = (): number => {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of expression');
    if (tok.type === 'num') { pos++; return tok.value; }
    if (tok.type === 'op' && tok.value === '(') {
      pos++;
      const v = expr();
      expect(')');
      return v;
    }
    if (tok.type === 'id') {
      pos++;
      // Own properties only: "constructor" or "toString" must not reach the prototype.
      if (Object.hasOwn(CONSTANTS, tok.value) && !isOp('(')) return CONSTANTS[tok.value];
      const fn = Object.hasOwn(FUNCTIONS, tok.value) ? FUNCTIONS[tok.value] : undefined;
      if (!fn) throw new Error(`Unknown name "${tok.value}"`);
      expect('(');
      const args: number[] = [];
      if (!isOp(')')) {
        args.push(expr());
        while (isOp(',')) { pos++; args.push(expr()); }
      }
      expect(')');
      return fn(...args);
    }
    throw new Error(`Unexpected "${tok.value}"`);
  };

  const value = expr();
  if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos].value}" after the expression`);
  return value;
}

export function calculate(expression: string): { expression: string; result: number; formatted: string } {
  const result = evaluate(expression);
  if (!Number.isFinite(result)) throw new Error(`The result is not a finite number (${result})`);
  const formatted = Number.isInteger(result) ? result.toString() : Number(result.toPrecision(12)).toString();
  return { expression, result, formatted };
}
