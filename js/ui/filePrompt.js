// Import feedback above the transport: "replace the current composition?"
// while a parsed file waits, or why the last file could not be loaded.

import { h } from './dom.js';
import { ui } from './strings.js';

export function createFilePrompt(container, { onConfirm, onCancel, onDismissError }) {
  const message = h('span', { class: 'prompt-text' });
  const yes = h('button', { type: 'button', class: 'btn', 'data-act': 'replace', onclick: onConfirm });
  const no = h('button', { type: 'button', class: 'btn subtle', 'data-act': 'cancel-import', onclick: () => no.dataset.error ? onDismissError() : onCancel() });
  container.classList.add('prompt');
  container.setAttribute('role', 'status');
  container.append(message, yes, no);

  return {
    render(state) {
      const { pendingImport, fileError } = state;
      container.hidden = !pendingImport && !fileError;
      container.classList.toggle('error', Boolean(fileError));
      const text = ui(state.lang).files;
      if (pendingImport) {
        message.textContent = text.replaceAsk(pendingImport.title);
        yes.hidden = false;
        yes.textContent = text.replace;
        no.textContent = text.cancel;
        delete no.dataset.error;
      } else if (fileError) {
        message.textContent = text.error(fileError.code, fileError.path);
        yes.hidden = true;
        no.textContent = text.ok;
        no.dataset.error = 'true';
      }
    },
  };
}
