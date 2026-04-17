import React from "react";
import ReactDOM from "react-dom/client";
import AppShell from "./AppShell";

// 阻止 WebKit 默认右键菜单
if (typeof window !== 'undefined') {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
