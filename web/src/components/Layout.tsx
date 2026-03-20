import { type ReactNode, useState, useEffect, useRef } from "react";

function goHome(e: React.MouseEvent) {
  e.preventDefault();
  window.history.pushState(null, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function shortUrl(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

type PaymentFlash = { id: string; url: string; status: string; key: number };

export function Layout({ children }: { children: ReactNode }) {
  const [flash, setFlash] = useState<PaymentFlash | null>(null);
  const lastSeenRef = useRef<string>("");
  const keyRef = useRef(0);

  useEffect(() => {
    let running = true;

    async function poll() {
      try {
        const res = await fetch("/v1/stats?range=1m");
        const data = await res.json();
        const payments = data.recentPayments;
        if (payments && payments.length > 0 && payments[0].id !== lastSeenRef.current) {
          lastSeenRef.current = payments[0].id;
          keyRef.current++;
          setFlash({
            id: payments[0].id,
            url: payments[0].original_url ?? "",
            status: payments[0].status,
            key: keyRef.current,
          });
        }
      } catch {}
      if (running) setTimeout(poll, 5000);
    }
    poll();
    return () => { running = false; };
  }, []);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <a href="/" className="header-brand" onClick={goHome}>
            <span className="header-wordmark">mpp.daimo.com</span>
          </a>
          <div className="header-live">
            <span className="header-live-dot" />
            {flash ? (
              <span className="header-live-text header-live-flash" key={flash.key} onAnimationEnd={() => setFlash(null)}>
                {flash.status === "succeeded" ? "Paid" : flash.status} &middot; {shortUrl(flash.url)}
              </span>
            ) : (
              <span className="header-live-text">Live</span>
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
