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
} from '../src';
import { FileStructure, loadExample } from './build';

const examplePath = path.join(__dirname, 'examples');

const { document, DOMParser } = new JSDOM('').window;

function mystToCurvenote(fileStructure: FileStructure) {
  if (fileStructure.myst) {
    const myst = fileStructure.myst as string;
    const newCurvenote = toYAML(fromMarkdown(myst, 'full'));
    it('myst -> curvenote', () => expect(newCurvenote).toEqual(fileStructure.curvenote));
  }
}

function curvenoteToMyst(fileStructure: FileStructure) {
  if (fileStructure.myst) {
    const myst = fileStructure.myst as string;
    const newMyst = toMarkdown(fromYAML(fileStructure.curvenote, 'full'));
    it('curvenote -> myst', () => expect(newMyst).toEqual(myst));
  }
}

function curvenoteToText(fileStructure: FileStructure) {
  if (fileStructure.text) {
    const text = fileStructure.text as string;
    const newText = toText(fromYAML(fileStructure.curvenote, 'full'));
    it('curvenote -> text', () => expect(newText).toEqual(text));
  }
}

function htmlToCurvenote(fileStructure: FileStructure) {
  if (fileStructure.html) {
    const html = fileStructure.html as string;
    const newCurvenote = toYAML(fromHTML(html, 'full', document, DOMParser));
    it('html -> curvenote', () => expect(newCurvenote).toEqual(fileStructure.curvenote));
  }
}

function curvenoteToHTML(fileStructure: FileStructure) {
  if (fileStructure.html) {
    const html = fileStructure.html as string;
    const newHTML = toHTML(fromYAML(fileStructure.curvenote, 'full'), 'full', document);
    it('curvenote -> html', () => expect(newHTML).toEqual(html));
  }
}

function curvenoteToTex(fileStructure: FileStructure) {
  if (fileStructure.tex) {
    const tex = fileStructure.tex as string;
    const newTex = toTex(fromYAML(fileStructure.curvenote, 'full'));
    it('curvenote -> tex', () => expect(newTex).toEqual(tex));
  }
}

const folders = fs.readdirSync(path.join(examplePath));
folders.forEach((folder) => {
  describe(folder, () => {
    const files = fs.readdirSync(path.join(examplePath, folder));
    files.forEach((file) => {
      const fileStructure = loadExample(path.join(examplePath, folder, file));
      describe(fileStructure.description, () => {
        mystToCurvenote(fileStructure);
        curvenoteToMyst(fileStructure);
        curvenoteToText(fileStructure);
        htmlToCurvenote(fileStructure);
        curvenoteToHTML(fileStructure);
        curvenoteToTex(fileStructure);
      });
    });
  });
});
