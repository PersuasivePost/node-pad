import { useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { MonacoBinding } from "y-monaco";

function App() {
  // const [count, setCount] = useState(0);
  const editorRef = useRef<any>(null);

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor;
    // Initialize y
    const doc = new Y.Doc();

    // connect to webrtc
    const provider = new WebrtcProvider("test-room", doc);
    const type = doc.getText("monaco");

    // bind to Monaco
    const binding = new MonacoBinding(
      type,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      provider.awareness
    );

    console.log(provider.awareness);
  }

  return (
    <Editor
      height="100vh"
      width="100vw"
      theme="vs-light"
      onMount={handleEditorMount}
    />
  );
}

export default App;
