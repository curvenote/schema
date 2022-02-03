import fs from 'fs';
import { JSDOM } from 'jsdom';
import path from 'path';
import {
  fromHTML,
  toHTML,
  fromMarkdown,
  toMarkdown,
  toTex,
  toText,
  fromYAML,
  toYAML,
} from '../../src';

const { document, DOMParser } = new JSDOM('').window;

export enum ConversionDirections {
  roundtrip = 'roundtrip',
  import = 'import',
  export = 'export',
}

export enum ConversionFormats {
  myst = 'myst',
  html = 'html',
  text = 'text',
  tex = 'tex',
}

export type Conversion = {
  content: string;
  direction: ConversionDirections;
  format: ConversionFormats;
};

export type ConversionStructure = {
  description: string;
  curvenote: string;
  conversions: Conversion[];
};

export function loadExample(filename: string): ConversionStructure {
  const data = fs.readFileSync(filename, 'utf8');
  const lines = data.split('\n');
  let description = '';
  let delimiter = '';
  let curvenote = '';
  const conversions: Conversion[] = [];
  let content = '';
  let format: ConversionFormats = ConversionFormats.myst;
  let direction: ConversionDirections = ConversionDirections.roundtrip;
  let newDelimiter;
  let newFormat;
  let newDirection;
  lines.forEach((line) => {
    if (delimiter === '') {
      if (line.split(' ')[1] === 'curvenote') {
        description = description.trim();
        [delimiter] = line.split(' ');
      } else {
        description += `${line}\n`;
      }
      return;
    }
    [newDelimiter, newFormat, newDirection] = line.split(' ');
    if (newDelimiter === delimiter) {
      if (curvenote === '') {
        curvenote = `${content.trim()}\n`;
      } else {
        conversions.push({ content: content.trim(), direction, format });
      }
      content = '';
      newDirection = newDirection || ConversionDirections.roundtrip;
      if (!(newFormat in ConversionFormats) || !(newDirection in ConversionDirections)) {
        throw Error(`Invalid format "${newFormat}" or direction "${newDirection}"`);
      }
      [format, direction] = [newFormat as ConversionFormats, newDirection as ConversionDirections];
    } else {
      content += line;
      if (format !== ConversionFormats.html || !content.endsWith('>')) {
        content += '\n';
      }
    }
  });
  if (curvenote === '') {
    curvenote = content;
  } else {
    conversions.push({ content: content.trim(), direction, format });
  }
  return { description, curvenote, conversions };
}

function mystToCurvenote(curvenote: string, myst: string, messagePrefix: string) {
  const newCurvenote = toYAML(fromMarkdown(myst, 'full'));
  it(`${messagePrefix} myst      -> curvenote`, () => expect(newCurvenote).toEqual(curvenote));
}

function curvenoteToMyst(curvenote: string, myst: string, messagePrefix: string) {
  const newMyst = toMarkdown(fromYAML(curvenote, 'full'));
  it(`${messagePrefix} curvenote -> myst`, () => expect(newMyst).toEqual(myst));
}

function htmlToCurvenote(curvenote: string, html: string, messagePrefix: string) {
  const newCurvenote = toYAML(fromHTML(html, 'full', document, DOMParser));
  it(`${messagePrefix} html      -> curvenote`, () => expect(newCurvenote).toEqual(curvenote));
}

function curvenoteToHTML(curvenote: string, html: string, messagePrefix: string) {
  const newHTML = toHTML(fromYAML(curvenote, 'full'), 'full', document);
  it(`${messagePrefix} curvenote -> html`, () => expect(newHTML).toEqual(html));
}

function curvenoteToText(curvenote: string, text: string, messagePrefix: string) {
  const newText = toText(fromYAML(curvenote, 'full'));
  it(`${messagePrefix} curvenote -> text`, () => expect(newText).toEqual(text));
}

function textToCurvenote(curvenote: string, text: string, messagePrefix: string) {
  const newCurvenote = text;
  // TODO: fromText
  // const newCurvenote = toYAML(fromText(text, 'full'));
  it.skip(`${messagePrefix} text      -> curvenote`, () => expect(newCurvenote).toEqual(curvenote));
}

function curvenoteToTex(curvenote: string, tex: string, messagePrefix: string) {
  const newTex = toTex(fromYAML(curvenote, 'full'));
  it(`${messagePrefix} curvenote -> tex`, () => expect(newTex).toEqual(tex));
}

function texToCurvenote(curvenote: string, tex: string, messagePrefix: string) {
  const newCurvenote = tex;
  // TODO: fromTex
  // const newCurvenote = toYAML(fromTex(tex, 'full')); // TODO: fromTex
  it.skip(`${messagePrefix} tex       -> curvenote`, () => expect(newCurvenote).toEqual(curvenote));
}

export function conversionTests(directory: string) {
  const dirSplit = directory.split(path.sep);
  describe(dirSplit[dirSplit.length - 1], () => {
    let exportFcn;
    let importFcn;
    const files = fs.readdirSync(directory);
    files.forEach((file) => {
      if (!file.endsWith('.txt')) {
        return;
      }
      const structure = loadExample(path.join(directory, file));
      describe(structure.description, () => {
        structure.conversions.forEach((conversion) => {
          switch (conversion.format) {
            case ConversionFormats.myst:
              exportFcn = curvenoteToMyst;
              importFcn = mystToCurvenote;
              break;
            case ConversionFormats.html:
              exportFcn = curvenoteToHTML;
              importFcn = htmlToCurvenote;
              break;
            case ConversionFormats.text:
              exportFcn = curvenoteToText;
              importFcn = textToCurvenote;
              break;
            case ConversionFormats.tex:
              exportFcn = curvenoteToTex;
              importFcn = texToCurvenote;
              break;
            default:
              throw Error(`Invalid format ${conversion.format}`);
          }
          switch (conversion.direction) {
            case ConversionDirections.roundtrip:
              exportFcn(structure.curvenote, conversion.content, 'roundtrip: ');
              importFcn(structure.curvenote, conversion.content, '           ');
              break;
            case ConversionDirections.export:
              exportFcn(structure.curvenote, conversion.content, '  one way: ');
              break;
            case ConversionDirections.import:
              importFcn(structure.curvenote, conversion.content, '  one way: ');
              break;
            default:
              throw Error(`Invalid direction ${conversion.direction}`);
          }
        });
      });
    });
  });
}
