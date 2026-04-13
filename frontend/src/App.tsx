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
  const [uploadState, setUploadState] = useState<{
    status: "idle" | "uploading" | "success" | "error";
    fileName?: string;
    percent?: number;
    message?: string;
  }>({ status: "idle" });
  const [sharedFiles, setSharedFiles] = useState<
    {
      fileId: string;
      originalName: string;
      mimeType: string;
      size: number;
      uploadedAt: number;
    }[]
  >([]);

  const hasAutoClearedRef = useRef(false);

  useEffect(() => {
    if (!roomId) {
      const newRoomId = generateRoomId();
      navigate(`/room/${newRoomId}`, { replace: true });
      return;
    }

    // Reset UI state immediately when entering a room to avoid showing stale data
    // from the previously visited room while this room syncs.
    setSharedFiles([]);
    setUsers({});
    setCurrentUser("");
    setUploadState({ status: "idle" });

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

    // Filter out stale file entries that don't exist on the backend anymore.
    // (This can happen if the server cleared its in-memory store or restarted.)
    const validateFilesExist = async (items: any[]) => {
      const API_BASE =
        window.location.hostname === "localhost"
          ? "http://localhost:8080"
          : "https://node-pad-1.onrender.com";

      const checks = await Promise.all(
        items.map(async (f) => {
          try {
            const r = await fetch(
              `${API_BASE}/file/${roomId}/${encodeURIComponent(f.fileId)}`,
              { method: "HEAD" },
            );
            return r.ok;
          } catch {
            return false;
          }
        }),
      );

      const filtered = items.filter((_, idx) => checks[idx]);
      setSharedFiles(filtered);

      // If we removed stale entries, also update the Yjs array so peers stop seeing them.
      if (filtered.length !== items.length) {
        filesArray.delete(0, filesArray.length);
        if (filtered.length > 0) {
          filesArray.push(filtered);
        }
      }
    };

    const WS_URL =
      window.location.hostname === "localhost"
        ? "ws://localhost:8080"
        : "wss://node-pad-1.onrender.com";

    const provider = new WebsocketProvider(WS_URL, roomId, doc);
    providerRef.current = provider;

    // Important: when joining an existing room, remote updates (including the "files" Y.Array)
    // may arrive *after* initial render. Re-sync once the provider is connected/synced.
    provider.on("sync", () => {
      const items = filesArray.toArray();
      setSharedFiles(items);
      void validateFilesExist(items);
    });

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

    const API_BASE =
      window.location.hostname === "localhost"
        ? "http://localhost:8080"
        : "https://node-pad-1.onrender.com";

    const clearRoomLocally = () => {
      // Clear shared files array
      if (filesArrayRef.current) {
        filesArrayRef.current.delete(0, filesArrayRef.current.length);
      }

      // Clear monaco doc
      if (docRef.current) {
        const monacoText = docRef.current.getText("monaco");
        if (monacoText.length > 0) {
          monacoText.delete(0, monacoText.length);
        }
      }
    };

    const clearRoomOnServer = async () => {
      if (!roomId) return;
      try {
        await fetch(`${API_BASE}/room/${roomId}`, { method: "DELETE" });
      } catch (err) {
        console.error("Failed to clear room on server:", err);
      }
    };

    awareness.on("change", () => {
      const states = awareness.getStates();
      const newUsers: { [key: string]: string } = {};
      states.forEach((state: any, clientId: any) => {
        if (state.user) {
          newUsers[clientId] = state.user.name;
        }
      });
      setUsers(newUsers);

      if (!hasAutoClearedRef.current && states.size === 1) {
        hasAutoClearedRef.current = true;
        clearRoomLocally();
        void clearRoomOnServer();
      }
    });

    return () => {
      clearRoomLocally();
      void clearRoomOnServer();

      hasAutoClearedRef.current = false;
      filesArray.unobserve(handleFilesChange);
      provider.destroy();
      doc.destroy();
    };
  }, [roomId, navigate]);

  async function handleFileUpload(file: File) {
    if (!roomId || !filesArrayRef.current) return;
    try {
      const API_BASE =
        window.location.hostname === "localhost"
          ? "http://localhost:8080"
          : "https://node-pad-1.onrender.com";

      setUploadState({
        status: "uploading",
        fileName: file.name,
        percent: 0,
      });

      const formData = new FormData();
      formData.append("file", file);

      const data = await new Promise<{
        fileId: string;
        originalName: string;
        mimeType: string;
        size: number;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/upload/${roomId}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadState({
              status: "uploading",
              fileName: file.name,
              percent,
            });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });

      filesArrayRef.current.push([
        {
          fileId: data.fileId,
          originalName: data.originalName,
          mimeType: data.mimeType,
          size: data.size,
          uploadedAt: Date.now(),
        },
      ]);

      setUploadState({
        status: "success",
        fileName: file.name,
        percent: 100,
      });
      setTimeout(() => setUploadState({ status: "idle" }), 1200);
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadState({
        status: "error",
        fileName: file.name,
        message: error instanceof Error ? error.message : "Upload failed",
      });
      setTimeout(() => setUploadState({ status: "idle" }), 2500);
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
      const API_BASE =
        window.location.hostname === "localhost"
          ? "http://localhost:8080"
          : "https://node-pad-1.onrender.com";

      const response = await fetch(`${API_BASE}/room/${roomId}`, {
        method: "DELETE",
      });
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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

          <div className="shared-files-section">
            <h4 className="users-title">Shared Files</h4>

            <label className="share-file-btn">
              Share File
              <input
                type="file"
                accept="*/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                  e.target.value = "";
                }}
              />
            </label>

            <div className="share-file-hint">
              Please upload files below 20MB.
            </div>

            {uploadState.status !== "idle" && (
              <div className="upload-status">
                <div className="upload-status-row">
                  <span className="upload-file-name">
                    {uploadState.status === "uploading"
                      ? `Uploading: ${uploadState.fileName}`
                      : uploadState.status === "success"
                        ? `Uploaded: ${uploadState.fileName}`
                        : `Upload failed: ${uploadState.fileName}`}
                  </span>
                  {uploadState.status === "uploading" && (
                    <span className="upload-percent">
                      {uploadState.percent ?? 0}%
                    </span>
                  )}
                </div>
                {uploadState.status === "uploading" && (
                  <div className="upload-bar">
                    <div
                      className="upload-bar-fill"
                      style={{ width: `${uploadState.percent ?? 0}%` }}
                    />
                  </div>
                )}
                {uploadState.status === "error" && uploadState.message && (
                  <div className="upload-error-msg">{uploadState.message}</div>
                )}
              </div>
            )}

            {sharedFiles.length === 0 ? (
              <div className="no-files-msg">No files shared yet</div>
            ) : (
              <ul className="files-list">
                {sharedFiles.map((f, i) => (
                  <li key={i} className="file-item">
                    <div className="file-info">
                      <span className="file-name" title={f.originalName}>
                        {f.originalName}
                      </span>
                      <span className="file-size">
                        {formatFileSize(f.size)}
                      </span>
                    </div>
                    <a
                      href={`${
                        window.location.hostname === "localhost"
                          ? "http://localhost:8080"
                          : "https://node-pad-1.onrender.com"
                      }/file/${roomId}/${f.fileId}`}
                      download={f.originalName}
                      className="file-download"
                      target="_blank"
                      rel="noreferrer"
                      onClick={async (e) => {
                        const API_BASE =
                          window.location.hostname === "localhost"
                            ? "http://localhost:8080"
                            : "https://node-pad-1.onrender.com";
                        try {
                          const r = await fetch(
                            `${API_BASE}/file/${roomId}/${encodeURIComponent(f.fileId)}`,
                            { method: "HEAD" },
                          );
                          if (r.status === 404 && filesArrayRef.current) {
                            e.preventDefault();
                            const arr = filesArrayRef.current.toArray();
                            const idx = arr.findIndex(
                              (x: any) => x?.fileId === f.fileId,
                            );
                            if (idx >= 0) {
                              filesArrayRef.current.delete(idx, 1);
                            }
                          }
                        } catch {
                          // Ignore network errors and let the normal download attempt happen.
                        }
                      }}
                    >
                      ↓
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div
        className="editor-container"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
      >
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
