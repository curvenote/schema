import { tableNodes } from 'prosemirror-tables';
import { Node } from 'prosemirror-model';
import { MdFormatSerialize, nodeNames, TexFormatSerialize, TexSerializerState } from '../types';
import { NodeGroups } from './types';
import { writeDirectiveOptions } from '../serialize/markdown/utils';
import { indent } from '../serialize/indent';

export const nodes = tableNodes({
  tableGroup: NodeGroups.top,
  cellContent: NodeGroups.blockOrEquation,
  cellAttributes: {
    background: {
      default: null,
      getFromDOM(dom: any) {
        return dom.style.backgroundColor || null;
      },
      setDOMAttr(value: any, attrs: any) {
        // eslint-disable-next-line prefer-template
        if (value) attrs.style = (attrs.style || '') + `background-color: ${value};`;
      },
    },
  },
});

/**
 * Create a "row" using a list-table
 * ```text
 * * - Col1
 *   - Col2
 * ```
 */
const renderListTableRow: MdFormatSerialize = (state, row) => {
  state.write('* ');
  const dedent = indent(state);
  row.content.forEach((cell) => {
    cell.content.forEach((content) => {
      indent(state);
      state.write('- ');
      state.renderInline(content);
      state.ensureNewLine();
      dedent();
    });
  });
  dedent();
};

export const toListTable: MdFormatSerialize = (state, node, figure, index) => {
  state.write('```{list-table}');
  if (state.nextTableCaption) {
    state.write(' ');
    state.renderInline(state.nextTableCaption);
    state.ensureNewLine();
  }
  const opts = { 'header-rows': 1, name: state.nextCaptionId };
  writeDirectiveOptions(state, opts);
  node.content.forEach((row) => {
    renderListTableRow(state, row, figure, index);
  });
  state.write('```');
  state.closeBlock(node);
};

export const toMarkdown: MdFormatSerialize = (state, node) => {
  let rowIndex = 0;

  node.content.forEach((child) => {
    if (child.type.name === nodeNames.table_row) {
      let isHeader = false;
      let columnIndex = 0;
      state.write('| ');
      // Create a fake header and switch `|---|` code off below
      child.content.forEach((cell) => {
        if (columnIndex === 0 && rowIndex === 0) {
          if (cell.type.name === nodeNames.table_header) {
            // mark this row as header row to append header string after this row before the second row rendering
            isHeader = true;
          } else {
            // Creates placeholder header with header seperator
            // | Column 1 | Column 2 |
            // |---|---|
            let headerStr = '|';
            let counter = 0;
            child.content.forEach(() => {
              counter += 1;
              headerStr += `Column ${counter} |`;
            });
            headerStr += '\n|';
            child.content.forEach(() => {
              headerStr += '---|';
            });
            headerStr += '\n';
            state.write(headerStr);
          }
        }

        if (cell.type.name === nodeNames.table_cell || cell.type.name === nodeNames.table_header) {
          const columnCount = Number(cell.attrs.colspan);
          if (columnCount > 1) {
            // Duplicate the content across columns
            for (let i = 0; i < columnCount; i += 1) {
              cell.content.forEach((content) => {
                state.renderInline(content);
                state.write(' ');
              });
              state.write(' |');
            }
          } else {
            state.write(' ');
            cell.content.forEach((content) => {
              state.renderInline(content);
            });
            state.write(' |');
          }
        }
        columnIndex += 1;
      });
      if (isHeader) {
        isHeader = false;
        state.ensureNewLine();
        state.write('|');
        child.content.forEach((cell) => {
          if (cell.type.name === nodeNames.table_header) {
            state.write('---|');
          }
        });
      }
      state.ensureNewLine();
    }
    rowIndex += 1;
  });
  state.closeBlock(node);
};

function getColumnWidths(node: Node<any>) {
  // should work for colspans in the first row, as a colspanned cell has an array of the widths it spans
  // TODO: unsure about rowspans
  const maybeWidths = (node.content.firstChild?.content as any).content.reduce(
    (acc: number[], cell: any) => {
      if (cell.attrs.colwidth == null) return [...acc, null];
      return [...acc, ...cell.attrs.colwidth];
    },
    [],
  );
  console.log('maybeWidths', maybeWidths);
  const nonNulls = maybeWidths.filter((w: number) => w != null).length;
  const avg =
    nonNulls === 0
      ? 50
      : maybeWidths
          .map((w: number) => (w == null ? 0 : w))
          .reduce((a: number, b: number) => a + b, 0) / nonNulls;
  console.log('avg', avg);
  const widths = maybeWidths.map((w: number) => (w == null ? avg : w));
  console.log('widths', widths);
  const total = widths.reduce((acc: number, cur: number) => acc + cur, 0);
  console.log('total', total);
  const fractionalWidths = widths.map((w: number) => w / total);
  console.log('fractionalWidths', fractionalWidths);
  const factor = 0.9;
  const columnSpec = fractionalWidths
    .map((w: number) => `p{${(factor * w).toFixed(5)}\\textwidth}`)
    .join('|');
  console.log('columnSpec', columnSpec);
  const numColumns =
    widths.length > 0 ? widths.length : node?.content?.firstChild?.content.childCount;
  console.log('numColumns', numColumns);

  return { widths, columnSpec, numColumns };
}

/**
 * convert prosemirror table node into latex table
 */
export function renderNodeToLatex(state: TexSerializerState, node: Node<any>) {
  const { widths, columnSpec, numColumns } = getColumnWidths(node);
  if (!numColumns) {
    throw new Error('invalid table format, no columns');
  }
  state.isInTable = true;

  // Note we can put borders in with `|*{3}{c}|` and similarly on the multicolumn below
  state.ensureNewLine();
  state.write(`\\begin{tabular}{${columnSpec}}`);
  state.ensureNewLine();
  const dedent = indent(state);
  state.write(`\\hline`);
  state.ensureNewLine();

  node.content.forEach(({ content: rowContent }) => {
    let i = 0;
    rowContent.forEach((cell) => {
      const {
        attrs: { colspan },
      } = cell;
      if (colspan > 1) state.write(`\\multicolumn{${colspan}}{c}{`);
      if (
        cell.content.childCount === 1 &&
        cell.content.child(0).type.name === nodeNames.paragraph
      ) {
        // Render simple things inline, otherwise render a block
        state.renderInline(cell.content.child(0));
      } else {
        cell.content.forEach((content) => {
          state.render(content);
        });
      }
      if (colspan > 1) state.write('}');
      if (i < rowContent.childCount - 1) {
        state.write(' & ');
      }
      i += 1;
    });
    state.write(' \\\\');
    state.ensureNewLine();
    // If the first cell in this row is a table header, make a line
    if (rowContent.firstChild?.type.name === nodeNames.table_header) {
      state.write('\\hline');
      state.ensureNewLine();
    }
  });
  state.write('\\hline');
  state.ensureNewLine();
  dedent();
  state.write('\\end{tabular}');
  state.closeBlock(node);
  state.isInTable = false;
}

export const toTex: TexFormatSerialize = (state, node) => {
  try {
    renderNodeToLatex(state, node);
  } catch (e) {
    state.write(`{\\bf Error converting \`${node.type.name}' to \\LaTeX}`);
  }
};
