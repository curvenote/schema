import { tableNodes } from 'prosemirror-tables';
import { Node } from 'prosemirror-model';
import { MarkdownSerializerState } from 'prosemirror-markdown';
import { nodeNames } from '../types';
import { FormatSerialize, NodeGroups } from './types';

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
        // eslint-disable-next-line no-param-reassign, prefer-template
        if (value) attrs.style = (attrs.style || '') + `background-color: ${value};`;
      },
    },
  },
});

export const toMarkdown: FormatSerialize = (state, node) => {
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
            // `| Column 1 | Column 2 | etc.`
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

/**
 * convert prosemirror table node into latex table
 */
export function renderNodeToLatex(state: MarkdownSerializerState, node: Node<any>) {
  // TODO: this might not work with colspan in the first row?
  const numColumns = node.content.firstChild?.content.childCount;
  if (!numColumns) {
    throw new Error('invalid table format, no columns');
  }

  // Note we can put borders in with `|*{3}{c}|` and similarly on the multicolumn below
  state.write(`\\begin{center}\n\\begin{tabular}{*{${numColumns}}{c}}\n\\hline\n`);

  node.content.forEach(({ content: rowContent }) => {
    let i = 0;
    rowContent.forEach((cell) => {
      const {
        attrs: { colspan },
      } = cell;
      if (colspan > 1) state.write(`\\multicolumn{${colspan}}{c}{`);

      cell.content.forEach((content) => {
        // NOTE: this doesn't work well for multi-paragraphs
        if (content.type.name === 'equation') {
          state.write('\\(\\displaystyle ');
        }
        state.renderInline(content);
        if (content.type.name === 'equation') {
          state.write(' \\)');
        }
      });
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
  state.write('\\hline\n\\end{tabular}\n\\end{center}\n');
  state.closeBlock(node);
}

export const toTex: FormatSerialize = (state, node) => {
  try {
    renderNodeToLatex(state, node);
  } catch (e) {
    state.write(`{\\bf Error converting \`${node.type.name}' to \\LaTeX}`);
  }
};
