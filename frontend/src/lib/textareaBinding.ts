import * as Y from "yjs";

/**
 * Two-way binding between a plain <textarea> and a Y.Text.
 *
 * Monaco is a desktop editor: on phones it fights the on-screen keyboard,
 * autocorrect and IME input. On touch devices we use a native textarea instead,
 * which gives proper mobile typing, selection handles and scrolling.
 */
export function bindTextarea(el: HTMLTextAreaElement, ytext: Y.Text) {
  const origin = Symbol("textarea");
  el.value = ytext.toString();

  const onInput = () => {
    const prev = ytext.toString();
    const next = el.value;
    if (prev === next) return;

    // Minimal diff: common prefix + common suffix, replace the middle.
    let start = 0;
    const maxStart = Math.min(prev.length, next.length);
    while (start < maxStart && prev[start] === next[start]) start++;
    let endPrev = prev.length;
    let endNext = next.length;
    while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
      endPrev--;
      endNext--;
    }

    ytext.doc?.transact(() => {
      if (endPrev > start) ytext.delete(start, endPrev - start);
      if (endNext > start) ytext.insert(start, next.slice(start, endNext));
    }, origin);
  };

  const onRemote = (event: Y.YTextEvent, tr: Y.Transaction) => {
    if (tr.origin === origin) return;

    // Shift the local caret/selection through the remote change.
    let selStart = el.selectionStart;
    let selEnd = el.selectionEnd;
    let index = 0;
    for (const op of event.delta) {
      if (op.retain != null) {
        index += op.retain;
      } else if (op.insert != null) {
        const len = typeof op.insert === "string" ? op.insert.length : 1;
        if (index < selStart) selStart += len;
        if (index < selEnd) selEnd += len;
        index += len;
      } else if (op.delete != null) {
        const len = op.delete;
        if (index < selStart) selStart = Math.max(index, selStart - len);
        if (index < selEnd) selEnd = Math.max(index, selEnd - len);
      }
    }

    const scrollTop = el.scrollTop;
    el.value = ytext.toString();
    if (document.activeElement === el) el.setSelectionRange(selStart, selEnd);
    el.scrollTop = scrollTop;
  };

  el.addEventListener("input", onInput);
  ytext.observe(onRemote);

  return () => {
    el.removeEventListener("input", onInput);
    ytext.unobserve(onRemote);
  };
}
