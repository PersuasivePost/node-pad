import { useRef, useState } from "react";
import { fileUrl, MAX_FILE_SIZE } from "../config";
import type { Peer, SharedFile } from "../hooks/useRoom";
import type { Upload } from "../hooks/useUploads";
import { fileExt, formatBytes, timeAgo } from "../lib/utils";
import {
  CheckIcon,
  DownloadIcon,
  LinkIcon,
  ShareIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from "./Icons";

type Props = {
  roomId: string;
  peers: Peer[];
  files: SharedFile[];
  uploads: Upload[];
  onUpload: (files: FileList | File[]) => void;
  onDismissUpload: (id: string) => void;
  onRemoveFile: (fileId: string) => void;
  onCopyLink: () => void;
  onShare?: () => void;
  onClearRoom: () => void;
  editorMode: "code" | "simple";
  onEditorMode: (m: "code" | "simple") => void;
  onClose: () => void;
  toast: (msg: string) => void;
};

export function SidePanel(p: Props) {
  return (
    <div className="panel-inner">
      <div className="panel-handle" onClick={p.onClose} aria-hidden="true" />
      <div className="panel-head">
        <span className="panel-title">Room</span>
        <button className="icon-btn panel-close" onClick={p.onClose} aria-label="Close panel">
          <XIcon />
        </button>
      </div>

      <section className="panel-section">
        <div className="room-code" aria-label="Room code">
          {p.roomId}
        </div>
        <div className="row-btns">
          <button className="btn" onClick={p.onCopyLink}>
            <LinkIcon size={14} /> Copy link
          </button>
          {p.onShare && (
            <button className="btn" onClick={p.onShare}>
              <ShareIcon size={14} /> Share
            </button>
          )}
        </div>
      </section>

      <section className="panel-section">
        <h4 className="section-title">
          People <span className="count">{p.peers.length}</span>
        </h4>
        <ul className="people">
          {p.peers.map((peer) => (
            <li key={peer.clientId} className="person">
              <span className="avatar" style={{ background: peer.color }}>
                {peer.name.charAt(0)}
              </span>
              <span className="person-name">{peer.name}</span>
              {peer.isMe && <span className="you-tag">you</span>}
            </li>
          ))}
        </ul>
      </section>

      <FilesSection {...p} />

      <section className="panel-section panel-foot">
        <div className="setting">
          <span>Editor</span>
          <div className="seg" role="radiogroup" aria-label="Editor mode">
            {(["code", "simple"] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={p.editorMode === m}
                className={p.editorMode === m ? "on" : ""}
                onClick={() => p.onEditorMode(m)}
              >
                {m === "code" ? "Code" : "Simple"}
              </button>
            ))}
          </div>
        </div>
        <button className="btn danger" onClick={p.onClearRoom}>
          <TrashIcon size={14} /> Clear room
        </button>
      </section>
    </div>
  );
}

function FilesSection({ roomId, files, uploads, onUpload, onDismissUpload, onRemoveFile, toast }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyFileLink = async (f: SharedFile) => {
    try {
      await navigator.clipboard.writeText(fileUrl(roomId, f.fileId));
      setCopied(f.fileId);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      toast("Couldn't copy link");
    }
  };

  const sorted = [...files].sort((a, b) => b.uploadedAt - a.uploadedAt);

  return (
    <section className="panel-section">
      <h4 className="section-title">
        Files <span className="count">{files.length}</span>
      </h4>

      <button
        className={`dropzone ${over ? "over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files);
        }}
      >
        <UploadIcon size={18} />
        <span className="dz-main">
          <span className="dz-desktop">Drop files or </span>
          <u>browse</u>
        </span>
        <span className="dz-hint">Up to {formatBytes(MAX_FILE_SIZE)} each · paste works too</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onUpload(e.target.files);
          e.target.value = "";
        }}
      />

      {uploads.length > 0 && (
        <ul className="uploads">
          {uploads.map((u) => (
            <li key={u.id} className={`upload ${u.status}`}>
              <div className="upload-row">
                <span className="upload-name" title={u.name}>
                  {u.name}
                </span>
                <span className="upload-meta">
                  {u.status === "uploading" && `${u.percent}%`}
                  {u.status === "done" && <CheckIcon size={14} />}
                </span>
                {u.status !== "done" && (
                  <button
                    className="icon-btn sm"
                    onClick={() => onDismissUpload(u.id)}
                    aria-label={u.status === "uploading" ? "Cancel upload" : "Dismiss"}
                  >
                    <XIcon size={12} />
                  </button>
                )}
              </div>
              {u.status === "error" ? (
                <div className="upload-error">{u.error}</div>
              ) : (
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${u.percent}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {sorted.length === 0 && uploads.length === 0 ? (
        <p className="empty">No files yet. Anything shared here is visible to everyone in the room.</p>
      ) : (
        <ul className="files">
          {sorted.map((f) => (
            <li key={f.fileId} className="file">
              {f.mimeType.startsWith("image/") ? (
                <a
                  className="thumb img"
                  href={fileUrl(roomId, f.fileId, true)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Preview ${f.originalName}`}
                >
                  <img src={fileUrl(roomId, f.fileId, true)} alt="" loading="lazy" />
                </a>
              ) : (
                <span className="thumb">{fileExt(f.originalName)}</span>
              )}
              <div className="file-info">
                <span className="file-name" title={f.originalName}>
                  {f.originalName}
                </span>
                <span className="file-meta">
                  {formatBytes(f.size)}
                  {f.uploadedBy && ` · ${f.uploadedBy}`} · {timeAgo(f.uploadedAt)}
                </span>
              </div>
              <div className="file-actions">
                <a
                  className="icon-btn"
                  href={fileUrl(roomId, f.fileId)}
                  download={f.originalName}
                  aria-label={`Download ${f.originalName}`}
                  title="Download"
                >
                  <DownloadIcon size={15} />
                </a>
                <button
                  className="icon-btn"
                  onClick={() => copyFileLink(f)}
                  aria-label="Copy file link"
                  title="Copy link"
                >
                  {copied === f.fileId ? <CheckIcon size={15} /> : <LinkIcon size={15} />}
                </button>
                <button
                  className="icon-btn"
                  onClick={() => onRemoveFile(f.fileId)}
                  aria-label={`Remove ${f.originalName}`}
                  title="Remove"
                >
                  <TrashIcon size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="fine">Files live in memory and disappear shortly after everyone leaves.</p>
    </section>
  );
}
