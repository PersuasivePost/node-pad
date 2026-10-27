import { useEffect, useRef, useState } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { MonacoBinding } from "y-monaco";
import "../lib/monacoSetup";
import { padTextKey, type Peer } from "../hooks/useRoom";
import type { EditorProps } from "./CollabEditor";

const MODEL_PREFIX = "inmemory://nodepad/";

export default function CodeEditor({ doc, awareness, padId, lang, dark, peers }: EditorProps) {
  const [editor, setEditor] = useState<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // One Monaco model per pad; rebind Yjs whenever the active pad changes.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const uri = monaco.Uri.parse(`${MODEL_PREFIX}${padId}`);
    const model = monaco.editor.getModel(uri) ?? monaco.editor.createModel("", lang, uri);
    editor.setModel(model);
    const binding = new MonacoBinding(
      doc.getText(padTextKey(padId)),
      model,
      new Set([editor]),
      awareness,
    );
    editor.focus();
    return () => binding.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, doc, padId, awareness]);

  useEffect(() => {
    const model = editor?.getModel();
    if (model && monacoRef.current) monacoRef.current.editor.setModelLanguage(model, lang);
  }, [editor, lang, padId]);

  // Dispose pad models when leaving the room.
  useEffect(
    () => () => {
      monacoRef.current?.editor
        .getModels()
        .filter((m) => m.uri.toString().startsWith(MODEL_PREFIX))
        .forEach((m) => m.dispose());
    },
    [],
  );

  return (
    <>
      <RemoteCursorStyles peers={peers} />
      <Editor
        height="100%"
        width="100%"
        theme={dark ? "nodepad-dark" : "nodepad-light"}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme("nodepad-light", {
            base: "vs",
            inherit: true,
            rules: [],
            colors: { "editor.background": "#ffffff", "editorLineNumber.foreground": "#b4b4bb", "editor.lineHighlightBackground": "#f6f6f7" },
          });
          monaco.editor.defineTheme("nodepad-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [],
            colors: { "editor.background": "#0b0b0c", "editorLineNumber.foreground": "#4a4a50", "editor.lineHighlightBackground": "#151517" },
          });
        }}
        loading={<div className="editor-loading">Loading editor…</div>}
        onMount={(ed, monaco) => {
          monacoRef.current = monaco;
          setEditor(ed);
        }}
        options={{
          wordWrap: "on",
          minimap: { enabled: false },
          fontSize: 14,
          lineHeight: 22,
          fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
          padding: { top: 16, bottom: 16 },
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          automaticLayout: true,
          quickSuggestions: false,
          wordBasedSuggestions: "off",
          suggestOnTriggerCharacters: false,
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
        }}
      />
    </>
  );
}

/** y-monaco tags remote selections with per-client classes; colour them + show the name. */
function RemoteCursorStyles({ peers }: { peers: Peer[] }) {
  const css = peers
    .filter((p) => !p.isMe)
    .map(
      (p) => `
.yRemoteSelection-${p.clientId}{background:${p.color}33}
.yRemoteSelectionHead-${p.clientId}{position:absolute;border-left:2px solid ${p.color};height:100%;box-sizing:border-box}
.yRemoteSelectionHead-${p.clientId}::after{content:${JSON.stringify(p.name)};position:absolute;top:-1.35em;left:-2px;background:${p.color};color:#fff;font:600 10px/1.6 system-ui,sans-serif;padding:0 5px;border-radius:3px 3px 3px 0;white-space:nowrap;pointer-events:none}`,
    )
    .join("");
  return <style>{css}</style>;
}
