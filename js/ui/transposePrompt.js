// The one-click transpose offered after the root picker moves while a lane
// has notes. The chords already followed the key; this moves the notes too.

import { rootLabel } from '../theory/scales.js';
import { h } from './dom.js';
import { ui } from './strings.js';

export function createTransposePrompt(container, { onConfirm, onDismiss }) {
  const message = h('span', { class: 'prompt-text' });
  const yes = h('button', { type: 'button', class: 'btn', 'data-act': 'transpose', onclick: onConfirm });
  const no = h('button', { type: 'button', class: 'btn subtle', 'data-act': 'keep', onclick: onDismiss });
  container.classList.add('prompt');
  container.setAttribute('role', 'status');
  container.append(message, yes, no);

  return {
    render(state) {
      const pending = state.pendingTranspose;
      container.hidden = !pending;
      if (!pending) return;
      const text = ui(state.lang).composer;
      message.textContent = text.transposeAsk(rootLabel(pending.fromPc, state.lang), rootLabel(state.rootPc, state.lang), pending.semis);
      yes.textContent = text.transposeYes;
      no.textContent = text.transposeNo;
    },
  };
}
