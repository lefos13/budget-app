import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { en } from '../src/lib/i18n/dictionaries/en';
import { el } from '../src/lib/i18n/dictionaries/el';

export interface Violation {
  file: string;
  line: number;
  column: number;
  kind: string;
  text: string;
}

const TARGET_ATTRS = new Set([
  'title',
  'placeholder',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'alt',
  'label',
  'content',
]);

const LABEL_KEY_REGEX =
  /^(label|title|text|message|description|heading|subtitle|placeholder|tooltip|name)$/i;

export function compareDictionaries(
  a: unknown,
  b: unknown,
  prefix = '',
  nameA = 'en',
  nameB = 'el'
): string[] {
  const problems: string[] = [];

  if (typeof a !== typeof b) {
    return [
      `Type mismatch at ${prefix || 'root'}: ${nameA} is ${typeof a}, ${nameB} is ${typeof b}`,
    ];
  }

  if (typeof a === 'string') {
    const sA = a as string;
    const sB = b as string;
    if (sA.trim() === '') problems.push(`Empty string in ${nameA}: ${prefix}`);
    if (sB.trim() === '') problems.push(`Empty string in ${nameB}: ${prefix}`);
    const phA = Array.from(sA.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (m) => m[1]).sort();
    const phB = Array.from(sB.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (m) => m[1]).sort();
    if (phA.join(',') !== phB.join(',')) {
      problems.push(
        `Placeholder mismatch at ${prefix}: ${nameA} has {${phA.join(', ')}}, ${nameB} has {${phB.join(', ')}}`
      );
    }
    return problems;
  }

  if (typeof a !== 'object' || a === null || b === null) {
    return [];
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  const allKeys = Array.from(new Set([...keysA, ...keysB])).sort();

  for (const k of allKeys) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (!(k in objA)) {
      problems.push(`Missing key in ${nameA}: ${full}`);
      continue;
    }
    if (!(k in objB)) {
      problems.push(`Missing key in ${nameB}: ${full}`);
      continue;
    }
    problems.push(...compareDictionaries(objA[k], objB[k], full, nameA, nameB));
  }

  return problems;
}

export function checkDictionaries(): string[] {
  return compareDictionaries(en, el);
}

function isIgnoredText(raw: string): boolean {
  // Strip HTML entities like &nbsp;
  const stripped = raw.replace(/&[a-zA-Z0-9#]+;/g, ' ').trim();
  // Pure punctuation/digit/currency/symbol strings (no letters)
  if (!/[A-Za-z\u0370-\u03FF]/.test(stripped)) return true;
  // Brand Aura
  const strippedPunct = stripped.replace(/^[^\w\u0370-\u03FF]+|[^\w\u0370-\u03FF]+$/g, '');
  if (strippedPunct === 'Aura') return true;
  // Currency/language/ISO-like or ALL-CAPS tokens of >=2 letters (EUR, EN, EL, ICS, JSON, PENDING, BILL, etc.)
  if (/^[A-Z0-9_]{2,}$/.test(stripped)) return true;
  return false;
}

function hasIgnoreComment(node: ts.Node, sf: ts.SourceFile, lines: string[]): boolean {
  const checkLine = (lineIdx: number): boolean => {
    if (lineIdx < 0 || lineIdx >= lines.length) return false;
    return lines[lineIdx].includes('i18n-ignore');
  };

  const start = node.getStart(sf);
  const { line } = sf.getLineAndCharacterOfPosition(start);
  if (checkLine(line) || checkLine(line - 1)) return true;

  // Check enclosing attribute, element, call expr, or expression
  let curr = node.parent;
  while (curr && curr !== sf) {
    if (
      ts.isJsxAttribute(curr) ||
      ts.isJsxElement(curr) ||
      ts.isJsxSelfClosingElement(curr) ||
      ts.isCallExpression(curr) ||
      ts.isJsxExpression(curr) ||
      ts.isPropertyAssignment(curr) ||
      ts.isVariableDeclaration(curr) ||
      ts.isReturnStatement(curr) ||
      ts.isConditionalExpression(curr) ||
      ts.isArrayLiteralExpression(curr)
    ) {
      const pStart = curr.getStart(sf);
      const pLine = sf.getLineAndCharacterOfPosition(pStart).line;
      if (checkLine(pLine) || checkLine(pLine - 1)) return true;
    }
    curr = curr.parent;
  }
  return false;
}

function isInsideImportOrExport(node: ts.Node): boolean {
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (
      ts.isImportDeclaration(curr) ||
      ts.isExportDeclaration(curr) ||
      ts.isImportEqualsDeclaration(curr) ||
      ts.isExternalModuleReference(curr)
    ) {
      return true;
    }
    if (ts.isCallExpression(curr) && curr.expression.kind === ts.SyntaxKind.ImportKeyword) {
      return true;
    }
    curr = curr.parent;
  }
  return false;
}

function isTypePosition(node: ts.Node): boolean {
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (
      ts.isLiteralTypeNode(curr) ||
      ts.isTypeNode(curr) ||
      ts.isTypeAliasDeclaration(curr) ||
      ts.isInterfaceDeclaration(curr) ||
      ts.isTypeElement(curr) ||
      ts.isTypeQueryNode(curr) ||
      ts.isTypeReferenceNode(curr)
    ) {
      return true;
    }
    if (
      (ts.isTypeAssertionExpression(curr) || ts.isAsExpression(curr) || ts.isSatisfiesExpression(curr)) &&
      curr.type === node
    ) {
      return true;
    }
    curr = curr.parent;
  }
  return false;
}

function isCaseClauseExpr(node: ts.Node): boolean {
  let curr = node;
  while (curr.parent && ts.isParenthesizedExpression(curr.parent)) {
    curr = curr.parent;
  }
  const p = curr.parent;
  if (p && ts.isCaseClause(p) && p.expression === curr) {
    return true;
  }
  return false;
}

function isEqualityOperand(node: ts.Node): boolean {
  let curr = node;
  while (curr.parent && ts.isParenthesizedExpression(curr.parent)) {
    curr = curr.parent;
  }
  const p = curr.parent;
  if (p && ts.isBinaryExpression(p)) {
    const op = p.operatorToken.kind;
    if (
      op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      op === ts.SyntaxKind.EqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsToken
    ) {
      return p.left === curr || p.right === curr;
    }
  }
  return false;
}

function isPropertyNameOrElementAccess(node: ts.Node): boolean {
  let curr = node;
  while (curr.parent && ts.isParenthesizedExpression(curr.parent)) {
    curr = curr.parent;
  }
  const p = curr.parent;
  if (!p) return false;
  if (
    (ts.isPropertyAssignment(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isPropertySignature(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isEnumMember(p)) &&
    p.name === curr
  ) {
    return true;
  }
  if (ts.isElementAccessExpression(p) && p.argumentExpression === curr) {
    return true;
  }
  return false;
}

function isInsideConsole(node: ts.Node): boolean {
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (ts.isCallExpression(curr)) {
      const expr = curr.expression;
      if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'console'
      ) {
        return true;
      }
    }
    curr = curr.parent;
  }
  return false;
}

function isInsideNewError(node: ts.Node): boolean {
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (ts.isNewExpression(curr)) {
      const expr = curr.expression;
      if (ts.isIdentifier(expr) && (expr.text === 'Error' || expr.text.endsWith('Error'))) {
        return true;
      }
    }
    curr = curr.parent;
  }
  return false;
}

function isInsideExcludedApiCall(node: ts.Node): boolean {
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (ts.isCallExpression(curr)) {
      const callee = curr.expression;
      if (ts.isIdentifier(callee) && callee.text === 'fetch') {
        return true;
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'JSON'
      ) {
        return true;
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        (callee.expression.text === 'localStorage' || callee.expression.text === 'sessionStorage')
      ) {
        return true;
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text.startsWith('toLocale')
      ) {
        return true;
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'Intl'
      ) {
        return true;
      }
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : '';
      if (calleeName === 'format' || calleeName === 'formatDate') {
        if (curr.arguments[1] === node || curr.arguments[1] === node.parent) {
          return true;
        }
      }
    }

    if (ts.isNewExpression(curr)) {
      const callee = curr.expression;
      if (ts.isIdentifier(callee) && (callee.text === 'Date' || callee.text === 'Headers')) {
        return true;
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'Intl'
      ) {
        return true;
      }
    }

    if (ts.isPropertyAssignment(curr)) {
      const propName = ts.isIdentifier(curr.name)
        ? curr.name.text
        : ts.isStringLiteral(curr.name)
        ? curr.name.text
        : '';
      if (propName.toLowerCase() === 'headers') {
        return true;
      }
    }

    if (ts.isParameter(curr)) {
      const paramName = ts.isIdentifier(curr.name) ? curr.name.text : '';
      if (
        paramName.toLowerCase().includes('pattern') ||
        paramName.toLowerCase().includes('format')
      ) {
        return true;
      }
    }

    curr = curr.parent;
  }
  return false;
}

function isInsideClassCallOrAttr(node: ts.Node, sf: ts.SourceFile): boolean {
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (ts.isJsxAttribute(curr)) {
      const attrName = ts.isIdentifier(curr.name) ? curr.name.text : curr.name.getText(sf);
      if (attrName === 'className') {
        return true;
      }
    }
    if (ts.isCallExpression(curr)) {
      const callee = curr.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : '';
      if (/^(cn|clsx|twMerge|cva)$/.test(name)) {
        return true;
      }
    }
    curr = curr.parent;
  }
  return false;
}

function isInsideNonTargetJsxAttribute(node: ts.Node, sf: ts.SourceFile): boolean {
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (
      ts.isJsxElement(curr) ||
      ts.isJsxFragment(curr) ||
      ts.isFunctionLike(curr) ||
      ts.isBlock(curr)
    ) {
      break;
    }
    if (ts.isJsxAttribute(curr)) {
      const attrName = ts.isIdentifier(curr.name) ? curr.name.text : curr.name.getText(sf);
      if (!TARGET_ATTRS.has(attrName)) {
        return true;
      }
      return false;
    }
    curr = curr.parent;
  }
  return false;
}

function isDatePattern(text: string): boolean {
  return /^[yYqQMwWdDeEcChiHkKmsSzaXx\s,./:'"-]+$/.test(text.trim());
}

function isInspectionCall(node: ts.Node): boolean {
  let curr = node;
  while (curr.parent && ts.isParenthesizedExpression(curr.parent)) {
    curr = curr.parent;
  }
  const p = curr.parent;
  if (p && ts.isCallExpression(p)) {
    const expr = p.expression;
    if (ts.isPropertyAccessExpression(expr)) {
      const methodName = expr.name.text;
      if (
        methodName === 'includes' ||
        methodName === 'startsWith' ||
        methodName === 'endsWith' ||
        methodName === 'indexOf' ||
        methodName === 'lastIndexOf' ||
        methodName === 'search' ||
        methodName === 'match' ||
        methodName === 'test'
      ) {
        return true;
      }
    }
  }
  return false;
}

function isExcluded(node: ts.Node, sf: ts.SourceFile, trimmed: string): boolean {
  if (/^(\/|https?:\/\/|mailto:|tel:|blob:|data:|#|\.\/|\.\.\/)/i.test(trimmed)) {
    return true;
  }
  if (/\.(png|jpe?g|svg|ico|webp|json|css|woff2?)$/i.test(trimmed)) {
    return true;
  }
  if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(trimmed)) {
    return true;
  }
  if (/^(Content-Type|Authorization|Accept|Cache-Control|Cookie|Set-Cookie)$/i.test(trimmed)) {
    return true;
  }
  if (/^[A-Z0-9_]{2,}$/.test(trimmed)) {
    return true;
  }

  if (isInsideImportOrExport(node)) return true;
  if (isTypePosition(node)) return true;
  if (isCaseClauseExpr(node)) return true;
  if (isEqualityOperand(node)) return true;
  if (isInspectionCall(node)) return true;
  if (isPropertyNameOrElementAccess(node)) return true;
  if (isInsideConsole(node)) return true;
  if (isInsideNewError(node)) return true;
  if (isInsideExcludedApiCall(node)) return true;
  if (isInsideClassCallOrAttr(node, sf)) return true;
  if (isInsideNonTargetJsxAttribute(node, sf)) return true;

  return false;
}

function matchesConditionA(text: string): boolean {
  const trimmed = text.trim();
  if (!/[A-Za-z\u0370-\u03FF]/.test(trimmed)) return false;
  if (!/\s/.test(trimmed)) return false;
  if (isDatePattern(trimmed)) return false;
  const strippedLeading = trimmed.replace(/^[^A-Za-z0-9\u0370-\u03FF]+/, '');
  return /^[A-Z\u0370-\u03FF]/.test(strippedLeading);
}

function isCapitalizedWord(text: string): boolean {
  const trimmed = text.trim();
  const strippedPunct = trimmed.replace(/^[^A-Za-z\u0370-\u03FF]+|[^A-Za-z\u0370-\u03FF]+$/g, '');
  return (
    /^[A-Z][a-z]{2,}$/.test(strippedPunct) ||
    /^[\u0391-\u03A9][\u03B1-\u03C9\u03AC-\u03CE]{2,}$/.test(strippedPunct)
  );
}

function getPropertyName(prop: ts.PropertyAssignment): string | undefined {
  if (ts.isIdentifier(prop.name)) return prop.name.text;
  if (ts.isStringLiteral(prop.name)) return prop.name.text;
  return undefined;
}

function isTernaryBranch(node: ts.Node): boolean {
  let curr = node;
  while (curr.parent && ts.isParenthesizedExpression(curr.parent)) {
    curr = curr.parent;
  }
  const p = curr.parent;
  if (p && ts.isConditionalExpression(p)) {
    return p.whenTrue === curr || p.whenFalse === curr;
  }
  return false;
}

function isReturnedValue(node: ts.Node): boolean {
  let curr = node;
  while (curr.parent && ts.isParenthesizedExpression(curr.parent)) {
    curr = curr.parent;
  }
  const p = curr.parent;
  if (p && ts.isReturnStatement(p) && p.expression === curr) {
    return true;
  }
  if (p && ts.isArrowFunction(p) && p.body === curr) {
    return true;
  }
  return false;
}

function isArrayOfCapitalizedWords(node: ts.Node): boolean {
  let curr = node;
  while (curr.parent && ts.isParenthesizedExpression(curr.parent)) {
    curr = curr.parent;
  }
  const p = curr.parent;
  if (p && ts.isArrayLiteralExpression(p)) {
    let capCount = 0;
    for (const elem of p.elements) {
      if (ts.isStringLiteral(elem) || ts.isNoSubstitutionTemplateLiteral(elem)) {
        if (!isIgnoredText(elem.text) && isCapitalizedWord(elem.text)) {
          capCount++;
        }
      }
    }
    return capCount >= 2;
  }
  return false;
}

function getUserFacingCallKind(call: ts.CallExpression): 'toast' | 'user-call' | null {
  const expr = call.expression;
  let funcName: string | null = null;
  let isToastObj = false;

  if (ts.isIdentifier(expr)) {
    funcName = expr.text;
  } else if (ts.isPropertyAccessExpression(expr)) {
    funcName = expr.name.text;
    if (ts.isIdentifier(expr.expression) && expr.expression.text === 'toast') {
      isToastObj = true;
    }
  }

  if (!funcName) return null;

  if (funcName === 'showToast' || funcName === 'toast' || isToastObj) {
    return 'toast';
  }

  const userFacingNames = new Set([
    'setError',
    'setFormError',
    'setMessage',
    'setSuccess',
    'alert',
    'confirm',
  ]);

  if (userFacingNames.has(funcName)) {
    return 'user-call';
  }

  return null;
}

function isUserFacingCallArg(node: ts.Node): boolean {
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (ts.isCallExpression(curr)) {
      if (getUserFacingCallKind(curr) !== null) {
        return true;
      }
    }
    if (ts.isStatement(curr) || ts.isFunctionLike(curr)) break;
    curr = curr.parent;
  }
  return false;
}

function isValidCapitalizedWordContext(node: ts.Node): boolean {
  // 1. Property value for a label-like key
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (ts.isPropertyAssignment(curr)) {
      const keyName = getPropertyName(curr);
      if (keyName && LABEL_KEY_REGEX.test(keyName)) {
        return true;
      }
    }
    if (ts.isStatement(curr) || ts.isFunctionLike(curr)) break;
    curr = curr.parent;
  }

  // 2. Ternary branch
  if (isTernaryBranch(node)) return true;

  // 3. Returned value
  if (isReturnedValue(node)) return true;

  // 4. Array element of 2+ Capitalized words
  if (isArrayOfCapitalizedWords(node)) return true;

  // 5. Call argument to user-facing calls
  if (isUserFacingCallArg(node)) return true;

  return false;
}

export function scanSource(fileName: string, text: string): Violation[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = text.split(/\r?\n/);
  const violations: Violation[] = [];
  const flaggedNodes = new Set<ts.Node>();

  function addViolation(node: ts.Node, kind: string, rawText: string) {
    if (flaggedNodes.has(node)) return;
    const trimmed = rawText.trim();
    if (isIgnoredText(trimmed)) return;
    if (isExcluded(node, sf, trimmed)) return;
    if (hasIgnoreComment(node, sf, lines)) return;

    flaggedNodes.add(node);
    const start = node.getStart(sf);
    const pos = sf.getLineAndCharacterOfPosition(start);
    violations.push({
      file: fileName,
      line: pos.line + 1,
      column: pos.character + 1,
      kind,
      text: trimmed,
    });
  }

  function checkExpressionContent(expr: ts.Expression | undefined) {
    if (!expr) return;
    if (ts.isParenthesizedExpression(expr)) {
      checkExpressionContent(expr.expression);
    } else if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      addViolation(expr, 'jsx-expression', expr.text);
    } else if (ts.isTemplateExpression(expr)) {
      if (/[A-Za-z\u0370-\u03FF]/.test(expr.head.text) && !isIgnoredText(expr.head.text)) {
        addViolation(expr.head, 'jsx-expression', expr.head.text);
      }
      for (const span of expr.templateSpans) {
        if (/[A-Za-z\u0370-\u03FF]/.test(span.literal.text) && !isIgnoredText(span.literal.text)) {
          addViolation(span.literal, 'jsx-expression', span.literal.text);
        }
      }
    } else if (ts.isConditionalExpression(expr)) {
      checkExpressionContent(expr.whenTrue);
      checkExpressionContent(expr.whenFalse);
    } else if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;
      if (
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken ||
        op === ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        if (op !== ts.SyntaxKind.AmpersandAmpersandToken) {
          checkExpressionContent(expr.left);
        }
        checkExpressionContent(expr.right);
      }
    } else if (ts.isArrayLiteralExpression(expr)) {
      for (const elem of expr.elements) {
        if (ts.isExpression(elem)) {
          checkExpressionContent(elem);
        }
      }
    }
  }

  function checkTargetAttributeInitializer(init: ts.Expression | ts.JsxExpression) {
    if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
      addViolation(init, 'jsx-attribute', init.text);
      return;
    }

    if (ts.isJsxExpression(init) && init.expression) {
      const exp = init.expression;
      if (ts.isStringLiteral(exp) || ts.isNoSubstitutionTemplateLiteral(exp)) {
        addViolation(exp, 'jsx-attribute', exp.text);
        return;
      }
      if (ts.isTemplateExpression(exp)) {
        if (/[A-Za-z\u0370-\u03FF]/.test(exp.head.text) && !isIgnoredText(exp.head.text)) {
          addViolation(exp.head, 'jsx-attribute', exp.head.text);
        }
        for (const span of exp.templateSpans) {
          if (/[A-Za-z\u0370-\u03FF]/.test(span.literal.text) && !isIgnoredText(span.literal.text)) {
            addViolation(span.literal, 'jsx-attribute', span.literal.text);
          }
        }
        return;
      }
      if (ts.isConditionalExpression(exp)) {
        checkTargetAttributeInitializer(exp.whenTrue);
        checkTargetAttributeInitializer(exp.whenFalse);
        return;
      }
      if (ts.isBinaryExpression(exp)) {
        const op = exp.operatorToken.kind;
        if (
          op === ts.SyntaxKind.BarBarToken ||
          op === ts.SyntaxKind.QuestionQuestionToken
        ) {
          checkTargetAttributeInitializer(exp.left);
          checkTargetAttributeInitializer(exp.right);
          return;
        }
      }
    }
  }

  function checkUserFacingCall(call: ts.CallExpression, kind: 'toast' | 'user-call') {
    for (const arg of call.arguments) {
      checkUserFacingCallArg(arg, kind);
    }
  }

  function checkUserFacingCallArg(arg: ts.Expression, kind: string) {
    if (ts.isParenthesizedExpression(arg)) {
      checkUserFacingCallArg(arg.expression, kind);
      return;
    }
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
      if (/[A-Za-z\u0370-\u03FF]/.test(arg.text)) {
        addViolation(arg, kind, arg.text);
      }
      return;
    }
    if (ts.isTemplateExpression(arg)) {
      if (/[A-Za-z\u0370-\u03FF]/.test(arg.head.text) && !isIgnoredText(arg.head.text)) {
        addViolation(arg.head, kind, arg.head.text);
      }
      for (const span of arg.templateSpans) {
        if (/[A-Za-z\u0370-\u03FF]/.test(span.literal.text) && !isIgnoredText(span.literal.text)) {
          addViolation(span.literal, kind, span.literal.text);
        }
      }
      return;
    }
    if (ts.isBinaryExpression(arg)) {
      const op = arg.operatorToken.kind;
      if (
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken
      ) {
        checkUserFacingCallArg(arg.left, kind);
        checkUserFacingCallArg(arg.right, kind);
        return;
      }
    }
    if (ts.isConditionalExpression(arg)) {
      checkUserFacingCallArg(arg.whenTrue, kind);
      checkUserFacingCallArg(arg.whenFalse, kind);
      return;
    }
  }

  function checkLabelProperty(prop: ts.PropertyAssignment) {
    checkLabelPropertyValue(prop.initializer);
  }

  function checkLabelPropertyValue(expr: ts.Expression) {
    if (ts.isParenthesizedExpression(expr)) {
      checkLabelPropertyValue(expr.expression);
      return;
    }
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      const text = expr.text.trim();
      if (isIgnoredText(text)) return;
      if (!/[A-Za-z\u0370-\u03FF]/.test(text)) return;

      const isMultiWord = /\s/.test(text);
      const startsCapLow = /^([A-Z][a-z]|[\u0391-\u03A9][\u03B1-\u03C9\u03AC-\u03CE])/.test(text);

      if (isMultiWord || startsCapLow) {
        addViolation(expr, 'label-property', expr.text);
      }
      return;
    }
    if (ts.isConditionalExpression(expr)) {
      checkLabelPropertyValue(expr.whenTrue);
      checkLabelPropertyValue(expr.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;
      if (
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken
      ) {
        checkLabelPropertyValue(expr.left);
        checkLabelPropertyValue(expr.right);
        return;
      }
    }
    if (ts.isTemplateExpression(expr)) {
      if (/[A-Za-z\u0370-\u03FF]/.test(expr.head.text) && !isIgnoredText(expr.head.text)) {
        addViolation(expr.head, 'label-property', expr.head.text);
      }
      for (const span of expr.templateSpans) {
        if (/[A-Za-z\u0370-\u03FF]/.test(span.literal.text) && !isIgnoredText(span.literal.text)) {
          addViolation(span.literal, 'label-property', span.literal.text);
        }
      }
      return;
    }
  }

  function checkArrayLiteral(node: ts.ArrayLiteralExpression) {
    const capWordElements: { elem: ts.Expression; text: string }[] = [];
    for (const elem of node.elements) {
      if (ts.isStringLiteral(elem) || ts.isNoSubstitutionTemplateLiteral(elem)) {
        const text = elem.text.trim();
        if (isIgnoredText(text)) continue;
        if (isCapitalizedWord(text)) {
          capWordElements.push({ elem, text });
        }
      }
    }

    if (capWordElements.length >= 2) {
      for (const item of capWordElements) {
        addViolation(item.elem, 'label-array', item.text);
      }
    }
  }

  function checkGenericString(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral) {
    if (flaggedNodes.has(node)) return;
    if (isIgnoredText(node.text)) return;
    if (isExcluded(node, sf, node.text)) return;

    if (matchesConditionA(node.text)) {
      addViolation(node, 'sentence', node.text);
      return;
    }

    if (isCapitalizedWord(node.text) && isValidCapitalizedWordContext(node)) {
      addViolation(node, 'sentence', node.text);
      return;
    }
  }

  function checkGenericTemplate(node: ts.TemplateExpression) {
    if (flaggedNodes.has(node)) return;

    if (
      !flaggedNodes.has(node.head) &&
      !isIgnoredText(node.head.text) &&
      !isExcluded(node.head, sf, node.head.text)
    ) {
      if (matchesConditionA(node.head.text)) {
        addViolation(node.head, 'sentence', node.head.text);
      } else if (
        isCapitalizedWord(node.head.text) &&
        isValidCapitalizedWordContext(node.head)
      ) {
        addViolation(node.head, 'sentence', node.head.text);
      }
    }

    for (const span of node.templateSpans) {
      if (
        !flaggedNodes.has(span.literal) &&
        !isIgnoredText(span.literal.text) &&
        !isExcluded(span.literal, sf, span.literal.text)
      ) {
        if (matchesConditionA(span.literal.text)) {
          addViolation(span.literal, 'sentence', span.literal.text);
        } else if (
          isCapitalizedWord(span.literal.text) &&
          isValidCapitalizedWordContext(span.literal)
        ) {
          addViolation(span.literal, 'sentence', span.literal.text);
        }
      }
    }
  }

  function visit(node: ts.Node) {
    // (a) JsxText
    if (ts.isJsxText(node)) {
      addViolation(node, 'jsx-text', node.getText(sf));
      return;
    }

    // (b) JsxAttribute
    if (ts.isJsxAttribute(node)) {
      const attrName = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sf);
      if (TARGET_ATTRS.has(attrName) && node.initializer) {
        checkTargetAttributeInitializer(node.initializer);
      }
    }

    // (c) User-facing calls: showToast, toast, setError, setFormError, setMessage, setSuccess, alert, confirm
    if (ts.isCallExpression(node)) {
      const callKind = getUserFacingCallKind(node);
      if (callKind) {
        checkUserFacingCall(node, callKind);
      }
    }

    // (d) JsxExpression used as element content
    if (ts.isJsxExpression(node)) {
      if (node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
        checkExpressionContent(node.expression);
      }
    }

    // (e) Object literal property assignment: label-like keys
    if (ts.isPropertyAssignment(node)) {
      const propName = getPropertyName(node);
      if (propName && LABEL_KEY_REGEX.test(propName)) {
        checkLabelProperty(node);
      }
    }

    // (f) Array literal: 2+ capitalized words
    if (ts.isArrayLiteralExpression(node)) {
      checkArrayLiteral(node);
    }

    // (g) Generic string literals and templates
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      checkGenericString(node);
    } else if (ts.isTemplateExpression(node)) {
      checkGenericTemplate(node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
  return violations;
}

export function findSourceFiles(rootDir: string = 'src'): string[] {
  const results: string[] = [];
  if (!fs.existsSync(rootDir)) return results;

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const norm = fullPath.replace(/\\/g, '/');
        if (norm.includes('.test.')) continue;
        if (norm.endsWith('.tsx')) {
          results.push(norm);
        } else if (norm.endsWith('.ts')) {
          // Check src/lib/**/*.ts
          if (norm.includes('/src/lib/') || norm.startsWith('src/lib/')) {
            if (norm.includes('/src/lib/i18n/') || norm.startsWith('src/lib/i18n/')) continue;
            const base = path.basename(norm);
            if (base.startsWith('month') && base.endsWith('.ts')) continue;
            if (
              base === 'recurrence.ts' ||
              base === 'ics-generator.ts' ||
              base === 'auth.ts' ||
              base === 'session.ts' ||
              base === 'prisma.ts'
            ) {
              continue;
            }
            results.push(norm);
          } else if (norm.includes('/src/context/') || norm.startsWith('src/context/')) {
            results.push(norm);
          }
        }
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

export function findTsxFiles(dir: string): string[] {
  return findSourceFiles(dir);
}

function runCli(): void {
  console.log('🔍 Checking i18n dictionaries parity and hardcoded UI text...\n');

  // 1. Dictionary parity check
  const dictErrors = checkDictionaries();
  if (dictErrors.length > 0) {
    console.error(`❌ Dictionary parity errors found (${dictErrors.length}):`);
    for (const err of dictErrors) {
      console.error(`  - ${err}`);
    }
    console.log();
  } else {
    console.log('✓ Dictionary parity check passed (en and el keys & placeholders match).\n');
  }

  // 2. Scan for hardcoded UI text
  const files = findSourceFiles('src');
  const violationsByFile = new Map<string, Violation[]>();
  let totalViolations = 0;

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const vios = scanSource(file, text);
    if (vios.length > 0) {
      violationsByFile.set(file, vios);
      totalViolations += vios.length;
    }
  }

  if (violationsByFile.size > 0) {
    console.log('🚩 Hardcoded UI text violations:');
    for (const [file, vios] of violationsByFile.entries()) {
      console.log(`\n${file} (${vios.length} violations):`);
      for (const v of vios) {
        console.log(`  ${v.file}:${v.line}:${v.column}  [${v.kind}] "${v.text}"`);
      }
    }

    console.log('\n--- Summary ---');
    console.log(`Total violations: ${totalViolations} across ${violationsByFile.size} files\n`);

    console.log('Violations by rule:');
    const countsByKind = new Map<string, number>();
    for (const vios of violationsByFile.values()) {
      for (const v of vios) {
        countsByKind.set(v.kind, (countsByKind.get(v.kind) || 0) + 1);
      }
    }
    for (const [kind, count] of Array.from(countsByKind.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  [${kind}]: ${count}`);
    }

    const topFiles = Array.from(violationsByFile.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 15);
    console.log('\nTop 15 files by violation count:');
    for (const [file, vios] of topFiles) {
      console.log(`  ${file}: ${vios.length}`);
    }
  } else {
    console.log('✓ No hardcoded UI text violations found!');
  }

  if (dictErrors.length > 0 || totalViolations > 0) {
    process.exit(1);
  }
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    return path.resolve(process.argv[1]) === path.resolve(currentFilePath);
  } catch {
    return process.argv[1].endsWith('check-i18n.ts');
  }
}

if (isDirectExecution()) {
  runCli();
}
