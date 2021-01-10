import { NodeGroups, FormatSerialize, NodeDef } from '../types';
import {
  createAttr as attr, createSpec, nodeToMystDirective, DEFAULT_FORMAT,
} from '../../utils';

export type Attrs = {
  name: string;
  value?: string;
  valueFunction?: string;
  format?: string;
};

export const def: NodeDef = {
  tag: 'r-var',
  name: 'variable',
  attrs: [
    attr('name', false, false),
    attr('value'),
    attr('format', false, DEFAULT_FORMAT),
  ],
  inline: false,
  group: NodeGroups.top,
};

const spec = createSpec(def);
export const toMarkdown: FormatSerialize = (state, node) => nodeToMystDirective(state, node, def);
export default spec;
