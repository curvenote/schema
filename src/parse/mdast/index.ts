import { Fragment, Mark, Node as ProsemirrorNode, NodeType, Schema } from 'prosemirror-model';
import { Root } from 'mdast';
import { GenericNode } from 'mystjs';
import { getSchema, UseSchema } from '../../schemas';
import { markNames, nodeNames } from '../../types';

type Attrs = Record<string, any>;
type ProtoNode = {
  type: NodeType;
  attrs: Attrs;
  content: (ProtoNode | ProsemirrorNode)[];
};

export enum ignoreNames {
  directive = 'directive',
  role = 'role',
}

function maybeMerge(a?: ProsemirrorNode, b?: ProsemirrorNode) {
  if (!a || !b) return undefined;
  if (a.isText && b.isText && Mark.sameSet(a.marks, b.marks)) return undefined; // a.withText(a.text + b.text);
  return undefined;
}

/** MarkdownParseState tracks the context of a running token stream.
 *
 * Loosly based on prosemirror-markdown
 */
export class MarkdownParseState {
  schema: Schema;

  marks: Mark[];

  stack: ProtoNode[];

  handlers: Record<string, TokenHandler>;

  constructor(schema: Schema, handlers: Record<string, TokenHandler>) {
    this.schema = schema;
    this.stack = [{ type: schema.topNodeType, attrs: {}, content: [] }];
    this.marks = Mark.none;
    this.handlers = handlers;
  }

  top() {
    return this.stack[this.stack.length - 1];
  }

  addNode(
    type: NodeType,
    attrs: Attrs,
    content: ProsemirrorNode<any> | Fragment<any> | ProsemirrorNode<any>[] | undefined,
  ) {
    const top = this.top();
    const node = type.createAndFill(attrs, content, this.marks);
    if (this.stack.length && node && 'content' in top) top.content.push(node);
    return node;
  }

  addText(text?: string) {
    const top = this.top();
    const value = text;
    if (!value || !this.stack.length || !('content' in top)) return;
    const last = top.content?.[top.content.length - 1];
    const node = this.schema.text(text, this.marks);
    const merged = maybeMerge(last as ProsemirrorNode, node);
    top.content?.push(merged || node);
  }

  // : (Mark)
  // Adds the given mark to the set of active marks.
  openMark(mark: Mark) {
    this.marks = mark.addToSet(this.marks);
  }

  // : (Mark)
  // Removes the given mark from the set of active marks.
  closeMark(mark: Mark) {
    this.marks = mark.removeFromSet(this.marks);
  }

  openNode(type: NodeType, attrs: Record<string, any>) {
    this.stack.push({ type, attrs, content: [] });
  }

  closeNode() {
    const node = this.stack.pop();
    if (!node) return undefined;
    return this.addNode(node.type, node.attrs, node.content as ProsemirrorNode[]);
  }

  parseTokens(tokens?: GenericNode[] | null) {
    tokens?.forEach((token) => {
      if (token.hidden) return;
      const handler = this.handlers[token.type];
      if (!handler)
        throw new Error(`Token type \`${token.type}\` not supported by tokensToMyst parser`);
      const { name, children } = handler(token, tokens);
      if (name in ignoreNames && children && typeof children !== 'string') {
        this.parseTokens(children);
      } else if (name === nodeNames.text) {
        if (typeof children === 'string') {
          this.addText(children);
        } else {
          throw new Error(`Invalid children of type ${typeof children} for node ${name}`);
        }
      } else if (name in nodeNames) {
        const nodeType = this.schema.nodes[name];
        const nodeAttrs = nodeType.spec.attrsFromMdastToken(token, tokens);
        this.openNode(nodeType, nodeAttrs);
        if (typeof children === 'string') {
          this.addText(children);
        } else {
          this.parseTokens(children);
        }
        this.closeNode();
      } else if (name in markNames) {
        const markType = this.schema.marks[name];
        const mark = markType.create(markType.spec.attrsFromMdastToken(token, tokens));
        this.openMark(mark);
        if (typeof children === 'string') {
          this.addText(children);
        } else {
          this.parseTokens(children);
        }
        this.closeMark(mark);
      }
    });
  }
}

type TokenHandler = (
  token: GenericNode,
  tokens: GenericNode[],
) => {
  name: nodeNames | markNames | ignoreNames;
  children?: GenericNode[] | string;
};

// type MdastHandler = {
//   block: string;
//   getAttrs?: (node: GenericNode) => Record<string, any>;
// };

const handlers: Record<string, TokenHandler> = {
  text: (token) => ({
    name: nodeNames.text,
    children: token.value,
  }),
  abbreviation: (token) => ({
    name: markNames.abbr,
    children: token.children,
  }),
  emphasis: (token) => ({
    name: markNames.em,
    children: token.children,
  }),
  inlineCode: (token) => ({
    name: markNames.code,
    children: token.value,
  }),
  link: (token) => ({
    name: markNames.link,
    children: token.children,
  }),
  strong: (token) => ({
    name: markNames.strong,
    children: token.children,
  }),
  subscript: (token) => ({
    name: markNames.subscript,
    children: token.children,
  }),
  superscript: (token) => ({
    name: markNames.superscript,
    children: token.children,
  }),
  paragraph: (token) => ({
    name: nodeNames.paragraph,
    children: token.children,
  }),
  thematicBreak: () => ({
    name: nodeNames.horizontal_rule,
  }),
  break: () => ({
    name: nodeNames.hard_break,
  }),
  heading: (token) => ({
    name: nodeNames.heading,
    children: token.children,
  }),
  blockquote: (token) => ({
    name: nodeNames.blockquote,
    children: token.children,
  }),
  code: (token) => ({
    name: nodeNames.code_block,
    children: token.value,
  }),
  list: (token) => ({
    name: token.ordered ? nodeNames.ordered_list : nodeNames.bullet_list,
    children: token.children,
  }),
  listItem: (token) => {
    let { children } = token;
    if (token.children?.length === 1 && token.children[0].type === 'text') {
      children = [{ type: 'paragraph', children }];
    }
    return {
      name: nodeNames.list_item,
      children,
    };
  },
  inlineMath: (token) => ({
    name: nodeNames.math,
    children: token.value,
  }),
  math: (token) => ({
    name: nodeNames.equation,
    children: token.value,
  }),
  container: (token) => ({
    name: nodeNames.figure,
    children: token.children,
  }),
  caption: (token) => ({
    name: nodeNames.figcaption,
    children: token.children,
  }),
  image: () => ({
    name: nodeNames.image,
  }),
  table: (token) => ({
    name: nodeNames.table,
    children: token.children,
  }),
  tableRow: (token) => ({
    name: nodeNames.table_row,
    children: token.children,
  }),
  tableCell: (token) => ({
    name: token.header ? nodeNames.table_header : nodeNames.table_cell,
    children: token.children,
  }),
  admonition: (token) => ({
    name: nodeNames.callout,
    children: token.children,
  }),
  directive: (token) => ({
    name: ignoreNames.directive,
    children: token.children,
  }),
  role: (token) => ({
    name: ignoreNames.role,
    children: token.children,
  }),
};

export function fromMdast(tree: Root, useSchema: UseSchema): ProsemirrorNode {
  const schema = getSchema(useSchema);

  const state = new MarkdownParseState(schema, handlers);
  state.parseTokens(tree.children as GenericNode[]);
  let doc: ProsemirrorNode | undefined;
  do {
    doc = state.closeNode() as ProsemirrorNode;
  } while (state.stack.length);
  return doc;
}