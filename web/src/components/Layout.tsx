import type { ReactNode } from "react";

function goHome(e: React.MouseEvent) {
  e.preventDefault();
  window.history.pushState(null, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <header className="header">
        <a href="/" className="header-brand" onClick={goHome}>
          <span className="header-wordmark">mpp.daimo.com</span>
        </a>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
