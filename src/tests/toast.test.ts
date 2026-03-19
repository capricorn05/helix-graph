import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { createToastController } from "../helix/primitives/toast.js";

const dom = new JSDOM("<!DOCTYPE html>");
global.document = dom.window.document as any;
global.window = dom.window as any;

test("toast: show and dismiss", () => {
  const viewport = document.createElement("div");
  document.body.appendChild(viewport);

  const toast = createToastController(viewport, { defaultDuration: 0 });
  const id = toast.show("Saved");

  assert.deepEqual(toast.list(), [id]);
  assert.equal(viewport.querySelectorAll("[data-hx-toast-id]").length, 1);

  toast.dismiss(id);
  assert.deepEqual(toast.list(), []);

  toast.destroy();
});

test("toast: auto dismisses after duration", async () => {
  const viewport = document.createElement("div");
  document.body.appendChild(viewport);

  const toast = createToastController(viewport, { defaultDuration: 5 });
  toast.show("Queued");

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(toast.list().length, 0);
  toast.destroy();
});
