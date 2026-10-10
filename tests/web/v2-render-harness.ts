import type { V2ShellRefs } from '../../src/web/v2-shell.ts';

interface DocumentSink {
  baseURI: string;
  createElement(tag: string): ElementSink;
  createElementNS(namespace: string, tag: string): ElementSink;
  createDocumentFragment(): ElementSink;
}
function documentSink(): DocumentSink {
  const document: DocumentSink = {
    baseURI: 'https://example.test/deployed/game/',
    createElement: () => new ElementSink(document),
    createElementNS: () => new ElementSink(document),
    createDocumentFragment: () => new ElementSink(document),
  };
  return document;
}

/** DOM projection sink, not a browser/layout substitute. textContent destroys children like the DOM. */
export class ElementSink {
  private text = '';
  get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
  set textContent(value: string) { this.text = value; this.children = []; }
  hidden = false;
  disabled = false;
  title = '';
  className = '';
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  children: ElementSink[] = [];
  previousElementSibling: ElementSink | null = null;
  following: ElementSink | null = null;
  removed = false;
  classList = {
    add: (_name: string) => {},
    toggle: (_name: string, _force: boolean) => {},
  };
  ownerDocument: DocumentSink;
  constructor(document = documentSink()) { this.ownerDocument = document; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  querySelector(_selector: string) { return null; }
  append(...nodes: ElementSink[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: ElementSink[]) { this.text = ''; this.children = nodes; }
  after(node: ElementSink) { this.following = node; }
  remove() { this.removed = true; }
}

export function shellSink() {
  const document = documentSink();
  const node = () => new ElementSink(document);
  const elements = Object.fromEntries([
    'root', 'phase', 'wave', 'gold', 'enemyPressure', 'capacity', 'enemyCount', 'bossTime', 'segmentTime',
    'wavePreview', 'waveCarry', 'waveTiming', 'arena', 'board', 'enemyLayer', 'bench', 'benchCount', 'offers', 'rerollButton', 'rerollCost',
    'selectionPanel', 'selectedName', 'selectedDetail', 'selectedStats', 'attack', 'attackSpeed', 'range',
    'recruitButton', 'recruitPreview', 'sellButton', 'cancelButton', 'synergies', 'synergyList', 'synergyCount',
    'startButton', 'pauseButton', 'message',
  ].map(key => [key, node()]));
  elements.attackSpeed.previousElementSibling = node();
  elements.attackSpeed.previousElementSibling.textContent = '공격 간격';
  elements.range.previousElementSibling = node();
  const slots = (count: number) => Array.from({ length: count }, () => ({
    button: node(), token: node(), label: node(), detail: node(),
  }));
  const sink = { ...elements, boardCells: slots(16), benchSlots: slots(8), offerSlots: slots(3) };
  return { elements, sink, shell: sink as unknown as V2ShellRefs };
}
