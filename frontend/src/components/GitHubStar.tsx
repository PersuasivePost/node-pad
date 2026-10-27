import { useEffect, useState } from "react";
import { GITHUB_OWNER, GITHUB_REPO, GITHUB_URL } from "../config";
import { GitHubIcon, StarIcon } from "./Icons";

const CACHE_KEY = "nodepad:stars";

function useStarCount() {
  const [count, setCount] = useState<number | null>(() => {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      return c && Date.now() - c.at < 30 * 60_000 ? c.count : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (count !== null) return;
    const ctrl = new AbortController();
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.stargazers_count !== "number") return;
        setCount(d.stargazers_count);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count: d.stargazers_count, at: Date.now() }));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [count]);

  return count;
}

export function GitHubStar() {
  const count = useStarCount();
  return (
    <a
      className="gh-star"
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      title="Star Node-Pad on GitHub"
      aria-label="Star Node-Pad on GitHub"
    >
      <GitHubIcon size={15} />
      <span className="gh-star-label">
        <StarIcon size={13} />
        <span className="gh-star-text">Star</span>
      </span>
      {!!count && <span className="gh-star-count">{count}</span>}
    </a>
  );
}
