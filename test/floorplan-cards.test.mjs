// Tests for home-assistant-3d-floorplan-cards: which floor/layer/view
// combination shows the card's cards.
//
// Same approach as navigate-action.test.mjs: stub just enough DOM to import the
// card, then exercise the static helpers.
import test from "node:test";
import assert from "node:assert/strict";

const defined = new Map();
globalThis.HTMLElement = class {
  attachShadow() { return {}; }
  addEventListener() {}
  dispatchEvent() { return true; }
};
globalThis.customElements = { define: (name, cls) => defined.set(name, cls) };
globalThis.document = { createElement: (tag) => ({ tag }) };
globalThis.window = {
  location: { hash: "", search: "" },
  history: { pushState() {} },
  dispatchEvent: () => true,
  addEventListener() {},
  customCards: [],
};

await import("../Home-Assistant-3D-Floorplan.js");
const Cards = defined.get("home-assistant-3d-floorplan-cards");

const state = { id: "home", activeFloor: "ground", activeLayer: "", activeView: "default" };
const config = (overrides) => ({ floors: [], layers: [], views: [], ...overrides });

test("the card and its editor are registered", () => {
  assert.ok(Cards);
  assert.ok(defined.has("home-assistant-3d-floorplan-cards-editor"));
  assert.ok(window.customCards.some((card) => card.type === "home-assistant-3d-floorplan-cards"));
});

test("without conditions the cards always show, even before the floorplan answers", () => {
  assert.equal(Cards.matches(config({}), null), true);
});

test("with conditions the cards wait for the floorplan", () => {
  assert.equal(Cards.matches(config({ layers: ["energy"] }), null), false);
});

test("layer 'all' stands for the All button", () => {
  assert.equal(Cards.matches(config({ layers: ["all"] }), state), true);
  assert.equal(Cards.matches(config({ layers: ["all"] }), { ...state, activeLayer: "energy" }), false);
});

test("any listed layer will do", () => {
  assert.equal(Cards.matches(config({ layers: ["energy", "lighting"] }), { ...state, activeLayer: "lighting" }), true);
  assert.equal(Cards.matches(config({ layers: ["energy"] }), state), false);
});

test("floor, layer and view must all hold", () => {
  const energy = { ...state, activeLayer: "energy" };
  assert.equal(Cards.matches(config({ layers: ["energy"], floors: ["ground"] }), energy), true);
  assert.equal(Cards.matches(config({ layers: ["energy"], floors: ["first"] }), energy), false);
  assert.equal(Cards.matches(config({ layers: ["energy"], views: ["kitchen"] }), energy), false);
  assert.equal(Cards.matches(config({ layers: ["energy"], views: ["kitchen"] }), { ...energy, activeView: "kitchen" }), true);
});

test("ids compare without case", () => {
  assert.equal(Cards.matches(config({ views: ["Kitchen"] }), { ...state, activeView: "kitchen" }), true);
});

test("lists accept YAML lists and comma separated text", () => {
  assert.deepEqual(Cards.list("energy, lighting,,energy"), ["energy", "lighting"]);
  assert.deepEqual(Cards.list(["energy"]), ["energy"]);
  assert.deepEqual(Cards.list(undefined), []);
});
