import { NodeSpec } from 'prosemirror-model';
import { NodeGroups, FormatSerialize } from './types';

export enum CalloutKinds {
  'active' = 'active',
  'success' = 'success',
  'info' = 'info',
  'warning' = 'warning',
  'danger' = 'danger',
}

const callout: NodeSpec = {
  group: NodeGroups.top,
  content: `${NodeGroups.block}+`,
  attrs: {
    kind: { default: CalloutKinds.info },
  },
  toDOM(node) { return ['aside', { class: `callout ${node.attrs.kind}` }, 0]; },
  parseDOM: [
    {
      tag: 'aside.callout',
      getAttrs(dom: any) {
        if (dom.classList.contains(CalloutKinds.active)) return { kind: CalloutKinds.active };
        if (dom.classList.contains(CalloutKinds.success)) return { kind: CalloutKinds.success };
        if (dom.classList.contains(CalloutKinds.info)) return { kind: CalloutKinds.info };
        if (dom.classList.contains(CalloutKinds.warning)) return { kind: CalloutKinds.warning };
        if (dom.classList.contains(CalloutKinds.danger)) return { kind: CalloutKinds.danger };
        return { kind: CalloutKinds.info };
      },
      // aside is also parsed, and this is higher priority
      priority: 60,
    },
  ],
};

export const toMarkdown: FormatSerialize = (state, node) => {
  state.ensureNewLine();
  const { kind } = node.attrs;
  // TODO: Translate between callout/admonition
  state.write(`\`\`\`{${kind || 'note'}}`);
  state.ensureNewLine();
  state.renderContent(node);
  state.write('```');
  state.closeBlock(node);
};

export default callout;
