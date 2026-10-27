import { lazy, Suspense, useEffect, useRef } from "react";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { bindTextarea } from "../lib/textareaBinding";
import { padTextKey, type Peer } from "../hooks/useRoom";

export type EditorProps = {
  doc: Y.Doc;
  awareness: Awareness;
  padId: string;
  lang: string;
  mode: "code" | "simple";
  dark: boolean;
  peers: Peer[];
};

// Monaco is ~2MB — only download it when the code editor is actually used.
const CodeEditor = lazy(() => import("./CodeEditor"));

export function CollabEditor(props: EditorProps) {
  if (props.mode === "simple") return <SimpleEditor {...props} />;
  return (
    <Suspense fallback={<div className="editor-loading">Loading editor…</div>}>
      <CodeEditor {...props} />
    </Suspense>
  );
}

function SimpleEditor({ doc, padId }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return bindTextarea(ref.current, doc.getText(padTextKey(padId)));
  }, [doc, padId]);

  return (
    <textarea
      ref={ref}
      className="simple-editor"
      placeholder="Start typing… everyone in this room sees it live."
      spellCheck
      autoCapitalize="sentences"
      aria-label="Note"
    />
  );
}
