import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { captureFirstTouch } from "@/lib/attribution";

// Remember where this visitor first came from (UTM/referrer) BEFORE the
// router mounts and any redirect can strip the query string.
captureFirstTouch();

createRoot(document.getElementById("root")!).render(<App />);
