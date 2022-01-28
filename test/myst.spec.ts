import { fromMarkdown, toMarkdown } from '../src';

const same = (snippet: string) => {
  const transformed = toMarkdown(fromMarkdown(snippet, 'full'));
  expect(transformed).toEqual(snippet);
};

describe('Markdown', () => {
  it('parses a simple text', () => same('hello!'));
  it('parses a simple text', () => same('```{note}\nhello!\n```'));
  it('parses a simple text', () => same('```{important}\nhello!\n```'));
  it('parses a simple text', () => same('```{admonition}\nhello!\n```'));
  it('parses a simple text', () => same('```{caution}\nhello!\n```'));
  it('parses a simple text', () => same('```{danger}\nhello!\n```'));
  it('parses a simple text', () => same('```{error}\nhello!\n```'));
  it('parses a simple text', () => same('```{hint}\nhello!\n```'));
  it('parses a simple text', () => same('```{tip}\nhello!\n```'));
  it('parses a simple text', () => same('```{warning}\nhello!\n```'));
  it('parses a simple text', () => same('```{attention}\nhello!\n```'));
});
