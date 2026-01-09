import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Hide initial HTML skeleton once React is ready
requestAnimationFrame(() => {
  document.body.classList.add('react-loaded');
  setTimeout(() => {
    const skeleton = document.getElementById('initialSkeleton');
    if (skeleton) skeleton.remove();
  }, 300);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
