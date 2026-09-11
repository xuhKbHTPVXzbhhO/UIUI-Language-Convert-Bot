const ZERO = "い";
const ONE = "う";

const MODE = {
  ascii: 0,
  hiragana: 1,
  katakana: 2,
  unicode: 3,
} as const;

const MASKS = [
  () => 0,
  (index: number) => index & 1,
  (index: number) => (index >> 1) & 1,
  (index: number) => (index % 3 === 0 ? 1 : 0),
];

type CodecResult = {
  text: string;
  error: string;
};

function uiFromNumber(value: number, width: number): string {
  return value
    .toString(2)
    .padStart(width, "0")
    .replaceAll("0", ZERO)
    .replaceAll("1", ONE);
}

function numberFromUi(value: string): number {
  return Number.parseInt(
    value.replaceAll(ZERO, "0").replaceAll(ONE, "1"),
    2,
  );
}

function normalize(input: string): string {
  return input
    .trim()
    .replace(/[\t\n\r　]+/g, " ")
    .replace(/ +/g, " ");
}

function applyMask(value: string, maskIndex: number): string {
  let bitIndex = 0;
  let sectionStart = true;

  return Array.from(value, (character) => {
    if (character === " ") {
      sectionStart = true;
      return character;
    }

    if (sectionStart) {
      sectionStart = false;
      return character;
    }

    const bit = character === ONE ? 1 : 0;
    return (bit ^ MASKS[maskIndex](bitIndex++)) === 1 ? ONE : ZERO;
  }).join("");
}

function encodeSection(text: string): string {
  const codePoints = Array.from(text, (character) => character.codePointAt(0)!);
  const segments: string[] = [];
  let currentMode: number | null = null;
  let payload = "";

  const flush = () => {
    if (currentMode === null || !payload) return;
    segments.push(`${ONE}${uiFromNumber(currentMode, 2)}${payload}`);
    currentMode = null;
    payload = "";
  };

  for (const codePoint of codePoints) {
    let mode: number;
    let value: number;
    let width: number;

    if (codePoint <= 0x7f) {
      mode = MODE.ascii;
      value = codePoint;
      width = 7;
    } else if (codePoint >= 0x3040 && codePoint <= 0x309f) {
      mode = MODE.hiragana;
      value = codePoint - 0x3040;
      width = 7;
    } else if (codePoint >= 0x30a0 && codePoint <= 0x30ff) {
      mode = MODE.katakana;
      value = codePoint - 0x30a0;
      width = 7;
    } else {
      mode = MODE.unicode;
      value = codePoint;
      width = 21;
    }

    if (mode !== currentMode) {
      flush();
      currentMode = mode;
    }

    payload += uiFromNumber(value, width);
  }

  flush();
  return segments.join(" ");
}

export function isUiLanguage(input: string): boolean {
  const normalized = normalize(input);

  if (!normalized || /[^うい ]/.test(normalized)) return false;

  const tokens = normalized.split(" ");
  if (tokens[0].length !== 2 || tokens.length < 2) return false;

  const mask = numberFromUi(tokens[0]);
  return Number.isInteger(mask) && mask >= 0 && mask < MASKS.length;
}

export function decodeFromUi(input: string): CodecResult {
  const normalized = normalize(input);

  if (!normalized) return { text: "", error: "" };

  if (/[^うい ]/.test(normalized)) {
    return { text: "", error: "「う」「い」と空白だけを入力してください。" };
  }

  const tokens = normalized.split(" ");

  if (tokens[0].length !== 2) {
    return { text: "", error: "先頭のマスク指定は2文字です。" };
  }

  const mask = numberFromUi(tokens[0]);

  if (
    !Number.isInteger(mask) ||
    mask < 0 ||
    mask >= MASKS.length ||
    tokens.length < 2
  ) {
    return { text: "", error: "符号が途中で終わっています。" };
  }

  const body = applyMask(tokens.slice(1).join(" "), mask);
  let text = "";

  for (const segment of body.split(" ")) {
    if (segment.length < 3 || !segment.startsWith(ONE)) {
      return { text: "", error: "シフト指示は「う」で始まる3文字です。" };
    }

    const mode = numberFromUi(segment.slice(1, 3));

    if (mode < MODE.ascii || mode > MODE.unicode) {
      return { text: "", error: "不正な文字モードです。" };
    }

    const width = mode === MODE.unicode ? 21 : 7;
    const payload = segment.slice(3);

    if (!payload || payload.length % width !== 0) {
      return { text: "", error: "シフト区間の長さが正しくありません。" };
    }

    for (let offset = 0; offset < payload.length; offset += width) {
      const value = numberFromUi(payload.slice(offset, offset + width));
      const codePoint =
        mode === MODE.hiragana
          ? value + 0x3040
          : mode === MODE.katakana
            ? value + 0x30a0
            : value;

      if (
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        return { text: "", error: "有効な文字コードではありません。" };
      }

      text += String.fromCodePoint(codePoint);
    }
  }

  return { text, error: "" };
}

export function encodeToUi(input: string, mask = 0): CodecResult {
  if (!Number.isInteger(mask) || mask < 0 || mask >= MASKS.length) {
    return { text: "", error: "マスクは0から3の整数で指定してください。" };
  }

  if (!input) return { text: "", error: "変換する文章を入力してください。" };

  const body = Array.from(input)
    .map((section) => encodeSection(section))
    .join(" ");

  return {
    text: `${uiFromNumber(mask, 2)} ${applyMask(body, mask)}`,
    error: "",
  };
}