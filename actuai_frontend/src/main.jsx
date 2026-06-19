// Vite entrypoint — mounts the React app into index.html's #root div.
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
