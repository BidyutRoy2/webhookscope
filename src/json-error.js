// WebhookScope — pinpoint JSON syntax errors (pure, no DOM).
// Returns null when the text is valid JSON, otherwise
// {line, column, position, message} for the offending character.
// A small recursive-descent parser locates the error exactly, because
// JSON.parse error messages do not reliably carry a position.

function toLineCol(text, index) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') { line++; lineStart = i + 1; }
  }
  return { line, column: index - lineStart + 1, position: index };
}

function describeChar(text, i) {
  if (i >= text.length) return 'end of input';
  const c = text[i];
  if (c === '\n') return 'newline';
  if (c === '\t') return 'tab';
  return `'${c}'`;
}

class JsonParser {
  constructor(text) {
    this.text = text;
    this.i = 0;
  }

  fail(index, message) {
    const err = new Error(message);
    err.index = index;
    throw err;
  }

  skipWs() {
    while (this.i < this.text.length && ' \t\n\r'.includes(this.text[this.i])) this.i++;
  }

  parse() {
    this.skipWs();
    if (this.i >= this.text.length) this.fail(0, 'Unexpected end of input — paste the getWebhookInfo JSON first.');
    this.parseValue();
    this.skipWs();
    if (this.i < this.text.length) {
      this.fail(this.i, `Unexpected ${describeChar(this.text, this.i)} after the JSON value — check for a trailing character.`);
    }
  }

  parseValue() {
    this.skipWs();
    if (this.i >= this.text.length) this.fail(this.text.length, 'Unexpected end of input — a value was expected here.');
    const c = this.text[this.i];
    if (c === '{') return this.parseObject();
    if (c === '[') return this.parseArray();
    if (c === '"') return this.parseString();
    if (c === 't') return this.parseLiteral('true');
    if (c === 'f') return this.parseLiteral('false');
    if (c === 'n') return this.parseLiteral('null');
    if (c === '-' || (c >= '0' && c <= '9')) return this.parseNumber();
    this.fail(this.i, `Unexpected ${describeChar(this.text, this.i)} — a value was expected here.`);
  }

  parseLiteral(word) {
    if (this.text.startsWith(word, this.i)) { this.i += word.length; return; }
    this.fail(this.i, `Expected '${word}' here.`);
  }

  parseNumber() {
    const start = this.i;
    if (this.text[this.i] === '-') this.i++;
    if (this.text[this.i] === '0') {
      this.i++;
    } else if (this.text[this.i] >= '1' && this.text[this.i] <= '9') {
      while (this.text[this.i] >= '0' && this.text[this.i] <= '9') this.i++;
    } else {
      this.fail(this.i, `Unexpected ${describeChar(this.text, this.i)} in a number.`);
    }
    if (this.text[this.i] === '.') {
      this.i++;
      if (!(this.text[this.i] >= '0' && this.text[this.i] <= '9')) this.fail(this.i, 'Expected a digit after the decimal point.');
      while (this.text[this.i] >= '0' && this.text[this.i] <= '9') this.i++;
    }
    if (this.text[this.i] === 'e' || this.text[this.i] === 'E') {
      this.i++;
      if (this.text[this.i] === '+' || this.text[this.i] === '-') this.i++;
      if (!(this.text[this.i] >= '0' && this.text[this.i] <= '9')) this.fail(this.i, 'Expected a digit in the exponent.');
      while (this.text[this.i] >= '0' && this.text[this.i] <= '9') this.i++;
    }
    if (this.i === start) this.fail(start, 'Expected a number here.');
  }

  parseString() {
    const start = this.i;
    this.i++; // opening quote
    while (this.i < this.text.length) {
      const c = this.text[this.i];
      if (c === '"') { this.i++; return; }
      if (c === '\\') {
        const e = this.text[this.i + 1];
        if (e === undefined) break;
        if ('"\\/bfnrt'.includes(e)) { this.i += 2; continue; }
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(this.text.slice(this.i + 2, this.i + 6))) {
            this.fail(this.i, 'Bad unicode escape — expected 4 hex digits after \\u.');
          }
          this.i += 6;
          continue;
        }
        this.fail(this.i, `Bad escape \\${e} in a string — only " \\ / b f n r t and \\uXXXX are allowed.`);
      }
      if (c === '\n' || c === '\r') {
        this.fail(this.i, 'Unterminated string — a newline inside a string needs \\n, or the closing quote is missing.');
      }
      if (c.charCodeAt(0) < 0x20) this.fail(this.i, 'Unescaped control character in a string.');
      this.i++;
    }
    this.fail(start, 'Unterminated string — the closing quote is missing.');
  }

  parseArray() {
    this.i++; // [
    this.skipWs();
    if (this.text[this.i] === ']') { this.i++; return; }
    for (;;) {
      this.parseValue();
      this.skipWs();
      if (this.text[this.i] === ',') { this.i++; this.skipWs(); continue; }
      if (this.text[this.i] === ']') { this.i++; return; }
      if (this.i >= this.text.length) this.fail(this.text.length, "Unexpected end of input — expected ',' or ']' in the array.");
      this.fail(this.i, `Expected ',' or ']' in the array, got ${describeChar(this.text, this.i)}.`);
    }
  }

  parseObject() {
    this.i++; // {
    this.skipWs();
    if (this.text[this.i] === '}') { this.i++; return; }
    for (;;) {
      this.skipWs();
      if (this.text[this.i] !== '"') {
        if (this.i >= this.text.length) this.fail(this.text.length, "Unexpected end of input — expected a property name in the object.");
        this.fail(this.i, `Expected a double-quoted property name, got ${describeChar(this.text, this.i)}.`);
      }
      this.parseString();
      this.skipWs();
      if (this.text[this.i] !== ':') {
        if (this.i >= this.text.length) this.fail(this.text.length, "Unexpected end of input — expected ':' after the property name.");
        this.fail(this.i, `Expected ':' after the property name, got ${describeChar(this.text, this.i)}.`);
      }
      this.i++;
      this.parseValue();
      this.skipWs();
      if (this.text[this.i] === ',') { this.i++; continue; }
      if (this.text[this.i] === '}') { this.i++; return; }
      if (this.i >= this.text.length) this.fail(this.text.length, "Unexpected end of input — expected ',' or '}' in the object.");
      this.fail(this.i, `Expected ',' or '}' in the object, got ${describeChar(this.text, this.i)}.`);
    }
  }
}

export function locateJsonError(raw) {
  if (typeof raw !== 'string') return { line: 1, column: 1, position: 0, message: 'Input is not text.' };
  try {
    JSON.parse(raw);
    return null;
  } catch {
    // Fall through to the locator below.
  }
  try {
    new JsonParser(raw).parse();
    return null;
  } catch (e) {
    const index = typeof e.index === 'number' ? e.index : 0;
    const { line, column } = toLineCol(raw, index);
    return { line, column, position: index, message: e.message };
  }
}
