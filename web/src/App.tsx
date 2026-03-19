import { useState, useEffect, useCallback } from "react";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { ProviderDetail } from "./components/ProviderDetail";

type View = { page: "home" } | { page: "detail"; providerId: string };

function parseView(): View {
  const path = window.location.pathname;
  const match = path.match(/^\/providers\/(.+)/);
  if (match) return { page: "detail", providerId: match[1] };
  return { page: "home" };
}

export function App() {
  const [view, setView] = useState<View>(parseView);

  const navigate = useCallback((v: View) => {
    const path = v.page === "detail" ? `/providers/${v.providerId}` : "/";
    window.history.pushState(null, "", path);
    setView(v);
  }, []);

  useEffect(() => {
    const onPop = () => setView(parseView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <Layout>
      {view.page === "detail" ? (
        <ProviderDetail
          providerId={view.providerId}
          onBack={() => navigate({ page: "home" })}
        />
      ) : (
        <Dashboard
          onSelectProvider={(id) => navigate({ page: "detail", providerId: id })}
        />
      )}
    </Layout>
  );
}
