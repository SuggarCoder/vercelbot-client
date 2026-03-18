import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/components/auth-provider";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const PYODIDE_SCRIPT_ID = "pyodide-runtime-script";
const PYODIDE_SCRIPT_SRC =
  "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";

function ensurePyodideScript() {
  if (typeof document === "undefined") {
    return;
  }

  if (document.getElementById(PYODIDE_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement("script");
  script.id = PYODIDE_SCRIPT_ID;
  script.src = PYODIDE_SCRIPT_SRC;
  script.async = false;
  document.head.appendChild(script);
}

export function ProtectedAppLayout() {
  const { isAuthenticated, isHydrated, session } = useAuth();
  const location = useLocation();

  useEffect(() => {
    ensurePyodideScript();
  }, []);

  if (!isHydrated) {
    return <div className="flex h-dvh bg-background" />;
  }

  if (!isAuthenticated) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate replace to={`/login?redirect=${encodeURIComponent(redirect)}`} />
    );
  }

  return (
    <DataStreamProvider>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar user={session?.user} />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </DataStreamProvider>
  );
}
