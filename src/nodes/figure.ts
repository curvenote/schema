import { Node } from 'prosemirror-model';
import { MdFormatSerialize } from '../serialize/types';
import { createLatexStatement } from '../serialize/tex/utils';
import { AlignOptions, CaptionKind, MyNodeSpec, NodeGroups, NumberedNode } from './types';
import { determineCaptionKind } from '../process/utils';
import {
  getColumnWidths,
  getFirstChildWithName,
  getNumberedAttrs,
  getNumberedDefaultAttrs,
  setNumberedAttrs,
} from './utils';
import { nodeNames } from '../types';
import type { Attrs as ImageAttrs } from './image';
import type { Attrs as IFrameAttrs } from './iframe';
import type { Attrs as CodeAttrs } from './code';
import { writeDirectiveOptions } from '../serialize/markdown/utils';

export type Attrs = NumberedNode & {
  align: AlignOptions;
};

const figure: MyNodeSpec<Attrs> = {
  group: NodeGroups.block,
  content: NodeGroups.insideFigure,
  isolating: true,
  attrs: {
    ...getNumberedDefaultAttrs(),
    align: { default: 'center' },
  },
  toDOM(node) {
    const { align } = node.attrs;
    return [
      'figure',
      {
        ...setNumberedAttrs(node.attrs),
        align,
      },
      0,
    ];
  },
  parseDOM: [
    {
      tag: 'figure',
      getAttrs(dom) {
        return {
          ...getNumberedAttrs(dom),
          align: dom.getAttribute('align') ?? 'center',
        };
      },
    },
  ],
};

export const toMarkdown: MdFormatSerialize = (state, node) => {
  state.ensureNewLine();
  const kind = determineCaptionKind(node);
  const { id } = node.attrs as Attrs;
  // TODO: Translate between callout/admonition
  const caption = getFirstChildWithName(node, nodeNames.figcaption);
  state.nextCaptionId = state.options.localizeId?.(id ?? '') ?? id ?? undefined;
  switch (kind) {
    case CaptionKind.fig: {
      const image = getFirstChildWithName(node, [nodeNames.image, nodeNames.iframe]);
      if (!image) return;
      const { src, width } = image?.attrs as ImageAttrs | IFrameAttrs;
      const href = state.options.localizeImageSrc?.(src) ?? src;
      if (image.type.name === nodeNames.iframe) {
        state.render(image);
        return;
      }
      state.write(`\`\`\`{figure} ${href}\n`);
      const opts = { name: state.nextCaptionId };
      writeDirectiveOptions(state, opts);
      if (caption) {
        state.renderInline(caption);
        state.ensureNewLine();
      }
      state.write('```');
      state.closeBlock(node);
      return;
    }
    case CaptionKind.eq: {
      state.renderContent(node);
      return;
    }
    case CaptionKind.table: {
      const table = getFirstChildWithName(node, [nodeNames.table]);
      state.nextTableCaption = caption;
      if (table) state.render(table);
      state.closeBlock(node);
      return;
    }
    case CaptionKind.code: {
      const code = getFirstChildWithName(node, [nodeNames.code_block]);
      const { language } = code?.attrs as CodeAttrs;
      state.write(`\`\`\`${language}\n`);
      if (code) state.renderContent(code);
      state.ensureNewLine();
      state.write('```');
      state.closeBlock(node);
      return;
    }
    default:
      throw new Error(`Unknown figure kind: "${kind}"`);
  }
};

function nodeToCommand(node: Node) {
  const kind = determineCaptionKind(node);
  switch (kind) {
    case CaptionKind.fig:
      return 'figure';
    case CaptionKind.table:
      return 'table';
    case CaptionKind.code:
      return 'code';
    case CaptionKind.eq:
      return 'figure'; // not sure what to do here.
    default:
      return 'figure';
  }
}

function nodeToLaTeXOptions(node: Node) {
  const kind = determineCaptionKind(node);
  switch (kind) {
    case CaptionKind.fig:
    case CaptionKind.table:
      return '!htbp';
    case CaptionKind.code:
      return 'H';
    case CaptionKind.eq:
    default:
      return undefined;
  }
}

function figureContainsTable(node: Node<any>) {
  const table = (node.content as any).content.find((n: any) => n.type.name === nodeNames.table);
  return table;
}

export const toTex = createLatexStatement(
  (state, node) => {
    if (state.isInTable) return null;
    state.containsTable = false;
    const table = figureContainsTable(node);
    let tableInfo;
    if (table) {
      state.containsTable = true;
      tableInfo = getColumnWidths(table);
    }
    return {
      command: state.containsTable ? 'longtable' : nodeToCommand(node),
      commandOpts: state.containsTable && tableInfo ? tableInfo.columnSpec : undefined,
      bracketOpts: state.containsTable ? undefined : nodeToLaTeXOptions(node),
    };
  },
  (state, node) => {
    if (state.isInTable) {
      state.renderContent(node);
      return;
    }
    const { numbered, id } = node.attrs as Attrs;
    const localId = state.options.localizeId?.(id ?? '') ?? id ?? undefined;
    // TODO: Based on align attr
    // may have to modify string returned by state.renderContent(n);
    // https://tex.stackexchange.com/questions/91566/syntax-similar-to-centering-for-right-and-left
    if (!state.containsTable) {
      // centering does not work in a longtable environment
      state.write('\\centering');
    }
    state.ensureNewLine();
    // Pass the relevant information to the figcaption
    state.nextCaptionNumbered = numbered;
    state.nextCaptionId = localId;
    state.renderContent(node);
    state.containsTable = false;
  },
);

export default figure;
