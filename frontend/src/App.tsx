import { useState, useRef, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
// import { WebrtcProvider } from "y-webrtc";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import "./App.css";

const animals = [
  "Elephant",
  "Tiger",
  "Lion",
  "Giraffe",
  "Zebra",
  "Panda",
  "Koala",
  "Kangaroo",
  "Monkey",
  "Bear",
  "Wolf",
  "Fox",
  "Rabbit",
  "Deer",
  "Horse",
  "Cow",
  "Pig",
  "Sheep",
  "Goat",
  "Chicken",
  "Duck",
  "Goose",
  "Turkey",
  "Peacock",
  "Owl",
  "Eagle",
  "Hawk",
  "Falcon",
  "Sparrow",
  "Robin",
  "Bluebird",
  "Cardinal",
  "Finch",
  "Canary",
  "Parrot",
  "Cockatoo",
  "Macaw",
  "Toucan",
  "Flamingo",
  "Swan",
  "Pelican",
  "Heron",
  "Crane",
  "Stork",
  "Ibis",
  "Egret",
  "Duck",
  "Goose",
  "Turkey",
  "Peacock",
  "Owl",
  "Eagle",
];

function generateRoomId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getRandomAnimal() {
  return animals[Math.floor(Math.random() * animals.length)];
}

function Notepad() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<any>(null);
  const docRef = useRef<Y.Doc | null>(null);
  // const providerRef = useRef<WebrtcProvider | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null); // Changed from WebrtcProvider
  const bindingRef = useRef<any>(null);
  const filesArrayRef = useRef<Y.Array<any> | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [users, setUsers] = useState<{ [key: string]: string }>({});
  const [currentUser, setCurrentUser] = useState("");
  const [sharedFiles, setSharedFiles] = useState<
    {
      fileId: string;
      originalName: string;
      mimeType: string;
      size: number;
      uploadedAt: number;
    }[]
  >([]);

  useEffect(() => {
    if (!roomId) {
      const newRoomId = generateRoomId();
      navigate(`/room/${newRoomId}`, { replace: true });
      return;
    }

    const doc = new Y.Doc();
    docRef.current = doc;

    // Initialize files array
    const filesArray = doc.getArray<any>("files");
    filesArrayRef.current = filesArray;

    // Set initial files from array
    setSharedFiles(filesArray.toArray());

    const handleFilesChange = () => {
      setSharedFiles(filesArray.toArray());
    };
    filesArray.observe(handleFilesChange);

    const provider = new WebsocketProvider(
      "wss://node-pad-1.onrender.com", // Render backend URL
      roomId,
      doc,
    );
    providerRef.current = provider;

    provider.on("status", (event: any) => {
      console.log("WebRTC status:", event.status);
    });

    const awareness = provider.awareness;
    const userName = getRandomAnimal();
    setCurrentUser(userName);
    awareness.setLocalStateField("user", {
      name: userName,
      color: "#" + Math.floor(Math.random() * 16777215).toString(16),
    });

    awareness.on("change", () => {
      const states = awareness.getStates();
      const newUsers: { [key: string]: string } = {};
      states.forEach((state: any, clientId: any) => {
        if (state.user) {
          newUsers[clientId] = state.user.name;
        }
      });
      setUsers(newUsers);
    });

    return () => {
      filesArray.unobserve(handleFilesChange);
      provider.destroy();
      doc.destroy();
    };
  }, [roomId, navigate]);

  async function handleFileUpload(file: File) {
    if (!roomId || !filesArrayRef.current) return;
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `https://node-pad-1.onrender.com/upload/${roomId}`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      filesArrayRef.current.push([
        {
          fileId: data.fileId,
          originalName: data.originalName,
          mimeType: data.mimeType,
          size: data.size,
          uploadedAt: Date.now(),
        },
      ]);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  }

  function handleEditorMount(editor: any, _monaco: any) {
    console.log("Editor mounted");
    editorRef.current = editor;
    if (docRef.current && providerRef.current) {
      const type = docRef.current.getText("monaco");
      const binding = new MonacoBinding(
        type,
        editorRef.current.getModel(),
        new Set([editorRef.current]),
        providerRef.current.awareness,
      );
      bindingRef.current = binding;
      console.log("Binding created");
    } else {
      console.log("Doc or provider not ready");
    }
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    // show temporary feedback instead of alert
    setCopyFeedback("Copied!");
    setTimeout(() => setCopyFeedback(""), 1500);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const [copyFeedback, setCopyFeedback] = useState("");

  const handleClearRoom = async () => {
    if (!roomId) return;
    try {
      const response = await fetch(
        `https://node-pad-1.onrender.com/room/${roomId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(`Clear failed: ${response.statusText}`);
      }

      if (filesArrayRef.current) {
        filesArrayRef.current.delete(0, filesArrayRef.current.length);
      }

      if (docRef.current) {
        const monacoText = docRef.current.getText("monaco");
        if (monacoText && monacoText.length > 0) {
          monacoText.delete(0, monacoText.length);
        }
      }
    } catch (error) {
      console.error("Error clearing room:", error);
    }
  };

  return (
    <div className="app">
      <div className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <button
          className="toggle-btn"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          {/* {sidebarCollapsed ? "→" : "←"} */}
        </button>
        <h3>Node-Pad</h3>
        <div className="sidebar-inner">
          <div className="room-header">
            <div className="room-id">{roomId}</div>
            <div className="copy-wrap">
              <button
                className="copy-btn"
                onClick={copyUrl}
                title="Copy room URL"
              >
                ⧉
              </button>
              {copyFeedback && (
                <span className="copy-feedback">{copyFeedback}</span>
              )}
            </div>
          </div>

          <button className="clear-room-btn" onClick={handleClearRoom}>
            Clear Room
          </button>

          <div className="user-me">
            <div className="avatar current">
              {currentUser?.charAt(0) || "U"}
            </div>
            <div className="me-info">
              <div className="me-name">{currentUser || "User"}</div>
              <div className="me-role">You</div>
            </div>
          </div>

          <h4 className="users-title">Active users</h4>
          <ul className="users-list">
            {Object.entries(users).map(([id, name]) => (
              <li key={id} className="user-item">
                <div className="avatar">{name?.charAt(0) || "U"}</div>
                <div className="user-name">{name}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="editor-container">
        <Editor
          height="100%"
          width="100%"
          theme="vs-light"
          onMount={handleEditorMount}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Notepad />} />
        <Route path="/room/:roomId" element={<Notepad />} />
      </Routes>
    </Router>
  );
}

export default App;
