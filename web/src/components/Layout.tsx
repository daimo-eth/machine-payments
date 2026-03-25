import { type ReactNode, useState, useEffect } from "react";

function goHome(e: React.MouseEvent) {
  e.preventDefault();
  window.history.pushState(null, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Layout({ children }: { children: ReactNode }) {
  const [txCount, setTxCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/v1/stats?range=all")
      .then((r) => r.json())
      .then((d) => setTxCount(d.totals?.transactions ?? null))
      .catch(() => {});
  }, []);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <img src="/daimo-circle.svg" alt="Daimo" width={24} height={24} />
            <a href="/" className="header-brand" onClick={goHome}>
              <span className="header-wordmark">mpp.daimo.com</span>
            </a>
            {txCount != null && txCount > 0 && (
              <span className="header-stat">{txCount} payments routed</span>
            )}
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="footer">
        <span>Built by <a href="https://daimo.com" target="_blank" rel="noopener noreferrer">Daimo</a></span>
      </footer>
    </div>
  );
}
