import React from "react";
import { createRoot } from "react-dom/client";
import { LegacyReviewQueue } from "../../src/components/legacy-review-queue";
import "../../src/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing synthetic fixture root");
createRoot(root).render(
  <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6" aria-label="Fixture sintética do acervo">
    <LegacyReviewQueue />
  </main>,
);
