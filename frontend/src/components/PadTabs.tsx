import { useEffect, useRef, useState } from "react";
import type { Pad } from "../hooks/useRoom";
import { isTouchDevice } from "../lib/utils";
import { PlusIcon, XIcon } from "./Icons";

type Props = {
  pads: Pad[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onClose: (id: string) => void;
};

export function PadTabs({ pads, activeId, onSelect, onAdd, onRename, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const longPress = useRef<number | undefined>(undefined);

  // Keep the active tab visible (e.g. right after "+").
  useEffect(() => {
    scrollerRef.current
      ?.querySelector<HTMLElement>(`[data-pad="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeId, pads.length]);

  const startLongPress = (id: string) => {
    window.clearTimeout(longPress.current);
    longPress.current = window.setTimeout(() => setEditingId(id), 550);
  };
  const cancelLongPress = () => window.clearTimeout(longPress.current);

  return (
    <div className="tabs" role="tablist" aria-label="Notes">
      <div className="tabs-scroll" ref={scrollerRef}>
        {pads.map((pad) => {
          const active = pad.id === activeId;
          return (
            <div
              key={pad.id}
              data-pad={pad.id}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              className={`tab ${active ? "active" : ""}`}
              onClick={() => onSelect(pad.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(pad.id);
                if (e.key === "F2") setEditingId(pad.id);
              }}
              onDoubleClick={() => setEditingId(pad.id)}
              onPointerDown={(e) => e.pointerType === "touch" && startLongPress(pad.id)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={(e) => isTouchDevice() && e.preventDefault()}
              title="Double-click (or long-press) to rename"
            >
              {editingId === pad.id ? (
                <input
                  className="tab-input"
                  autoFocus
                  defaultValue={pad.name}
                  maxLength={40}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (v && v !== pad.name) onRename(pad.id, v);
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <span className="tab-name">{pad.name}</span>
              )}
              {pads.length > 1 && (
                <button
                  className="tab-close"
                  aria-label={`Close ${pad.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(pad.id);
                  }}
                >
                  <XIcon size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button className="tab-add" onClick={onAdd} aria-label="New note" title="New note">
        <PlusIcon size={16} />
      </button>
    </div>
  );
}
