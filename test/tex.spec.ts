import { Node } from 'prosemirror-model';
import { TexFormatTypes } from '../src/serialize/types';
import { tnodes, tdoc } from './build';
import { toTex } from '../src';

const { pre, callout, aside } = tnodes;

const expectEnvironment = (
  name: string,
  doc: Node,
  format: TexFormatTypes = TexFormatTypes.tex,
) => {
  expect(toTex(doc, { format })).toEqual(`\\begin{${name}}\n  hello!\n\\end{${name}}`);
};

describe('Tex:curvenote - deprecated', () => {
  it('serializes a callout', () =>
    expectEnvironment('callout', tdoc(callout('hello!')), TexFormatTypes.tex_curvenote));
  it('serializes an aside', () =>
    expectEnvironment('aside', tdoc(aside('hello!')), TexFormatTypes.tex_curvenote));
  it('serializes a code_block', () =>
    expectEnvironment('verbatim', tdoc(pre('hello!')), TexFormatTypes.tex_curvenote));
});
