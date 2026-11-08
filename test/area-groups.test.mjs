// Tests for group_by_area layers (e.g. energy per room) and show_all_layer: false.
//
// Same approach as the other tests: stub just enough DOM to import the card,
// then exercise methods on a bare prototype.
import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------- DOM stubs
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
const Card = defined.get("home-assistant-3d-floorplan");

// ------------------------------------------------------------------ helpers
function row(entityId, extra = {}) {
  const domain = entityId.split(".")[0];
  return {
    key: entityId,
    entityId,
    name: entityId,
    deviceId: "",
    domain,
    domains: [domain],
    deviceClasses: extra.deviceClass ? [extra.deviceClass] : [],
    primaryDomain: domain,
    primaryDeviceClass: extra.deviceClass || "",
    primaryState: extra.state ?? "on",
    unit: extra.unit || "",
    offline: false,
    areaId: "unknown",
    areaName: "No area",
    ...extra,
  };
}

const kitchen = { areaId: "keuken", areaName: "Keuken" };
const living = { areaId: "woonkamer", areaName: "Woonkamer" };

const ROWS = [
  row("sensor.fridge_power", { deviceClass: "power", state: "80", unit: "W", ...kitchen }),
  row("sensor.oven_power", { deviceClass: "power", state: "1.2", unit: "kW", ...kitchen }),
  row("sensor.kettle_power", { deviceClass: "power", state: "unavailable", unit: "W", offline: true, ...kitchen }),
  row("sensor.tv_power", { deviceClass: "power", state: "0.4", unit: "W", ...living }),
  row("sensor.hall_power", { deviceClass: "power", state: "5", unit: "W" }),
  row("sensor.living_humidity", { deviceClass: "power", state: "0.0", unit: "%", ...living }),
  // A light whose plug sensor (layer_entities) lives in the living room.
  row("light.lamp", { ...kitchen }),
  row("sensor.lamp_power", { deviceClass: "power", state: "9", unit: "W", ...living }),
];

const placed = (...entityIds) => Object.fromEntries(entityIds.map((entityId) => [entityId, { entityId, x: 1, y: 2, z: 3 }]));

function makeCard({ markers = placed("sensor.fridge_power", "sensor.oven_power", "sensor.kettle_power", "sensor.tv_power", "sensor.hall_power", "sensor.living_humidity"), layers, config = {}, zones = {}, views = {} } = {}) {
  const card = Object.create(Card.prototype);
  card._config = { offline_states: ["unavailable", "unknown"], ...config };
  card._mode = "user";
  card._activeLayer = "energy";
  card._activeFloorId = "default";
  card._activeModelView = "default";
  card._selectedMarkers = new Set();
  card._markers = card._normalizedMarkers(markers);
  card._floorMarkers = { default: card._markers };
  card._layers = card._normalizedLayers(layers || [
    { id: "energy", name: "Energy", device_classes: ["power"], group_by_area: true },
    { id: "lights", name: "Lights", domains: ["light"] },
  ]);
  card._zones = zones;
  card._modelViews = { default: views };
  card._deviceRows = () => ROWS;
  card._refresh3DMarkerOverlay = () => {};
  card._refreshLayerSwitcher = () => {};
  card._broadcastNavState = () => {};
  card._render = () => {};
  card._isControlActive = () => false;
  return card;
}

const zone = (id, name, extra = {}) => ({ id, name, points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }], ...extra });
const byArea = (groups) => Object.fromEntries(groups.map((group) => [group.areaId, group]));

// ----------------------------------------------------------- normalisation
test("layers read group_by_area, thresholds and min_value", () => {
  const card = makeCard();
  const [layer] = card._normalizedLayers([{ id: "energy", group_by_area: true, thresholds: "1000, 50, x, 250", min_value: "1" }]);
  assert.equal(layer.groupByArea, true);
  assert.deepEqual(layer.thresholds, [50, 250, 1000]);
  assert.equal(layer.minValue, 1);
  const [plain] = card._normalizedLayers([{ id: "lights" }]);
  assert.equal(plain.groupByArea, false);
  assert.deepEqual(plain.thresholds, [50, 250, 1000]);
  assert.equal(plain.minValue, null);
});

// ------------------------------------------------------------------ values
test("power readings are converted to watts; other units are not power", () => {
  const card = makeCard();
  assert.equal(card._powerWatts(row("sensor.a", { state: "1.5", unit: "kW" })), 1500);
  assert.equal(card._powerWatts(row("sensor.a", { state: "12", unit: "W" })), 12);
  assert.ok(Number.isNaN(card._powerWatts(row("sensor.a", { state: "unavailable", unit: "W", offline: true }))));
  assert.equal(card._powerWatts(row("sensor.a", { state: "40", unit: "%" })), null);
});

test("power is formatted in W or kW", () => {
  const card = makeCard();
  assert.equal(card._formatPower(0.42), "0.4 W");
  assert.equal(card._formatPower(245.6), "246 W");
  assert.equal(card._formatPower(1280), "1.3 kW");
  assert.equal(card._formatPower(NaN), "–");
});

test("room colour follows the thresholds", () => {
  const card = makeCard();
  const colors = [10, 50, 300, 5000].map((watts) => card._roomLoadColor(watts, [50, 250, 1000]));
  assert.deepEqual(colors, ["#9e9e9e", "#43a047", "#fb8c00", "#e53935"]);
  assert.equal(card._roomLoadColor(NaN), "#9e9e9e");
});

// ------------------------------------------------------------------ groups
test("markers are summed per Home Assistant area; no area or no power unit stays a single marker", () => {
  const card = makeCard();
  const groups = byArea(card._areaGroups());
  assert.deepEqual(Object.keys(groups).sort(), ["keuken", "woonkamer"]);
  assert.equal(groups.keuken.total, 1280);
  assert.equal(groups.keuken.unknown, 1);
  assert.deepEqual([...groups.keuken.keys].sort(), ["sensor.fridge_power", "sensor.kettle_power", "sensor.oven_power"]);
  assert.equal(groups.woonkamer.total, 0.4);
  assert.ok(!groups.woonkamer.keys.has("sensor.living_humidity"));
  assert.equal(groups.keuken.color, "#e53935");
});

test("the area of the layer_entities sensor decides the room", () => {
  const card = makeCard({
    markers: { "light.lamp": { entityId: "light.lamp", x: 1, y: 2, z: 3, layer_entities: { energy: "sensor.lamp_power" } } },
  });
  const groups = byArea(card._areaGroups());
  assert.deepEqual(Object.keys(groups), ["woonkamer"]);
  assert.equal(groups.woonkamer.total, 9);
});

test("a room whose sensors are all unavailable has no total", () => {
  const card = makeCard({ markers: placed("sensor.kettle_power") });
  const [group] = card._areaGroups();
  assert.ok(Number.isNaN(group.total));
  assert.equal(group.color, "#9e9e9e");
});

test("only a group_by_area layer groups, and never in Edit Mode", () => {
  const card = makeCard({ layers: [{ id: "energy", device_classes: ["power"] }] });
  assert.deepEqual(card._areaGroups(), []);
  const grouping = makeCard();
  grouping._mode = "edit";
  assert.deepEqual(grouping._areaGroups(), []);
});

test("zones match an area by their area field, else by name", () => {
  const card = makeCard({ zones: { z1: zone("z1", "Kitchen", { area: "keuken" }), z2: zone("z2", "Woon kamer") } });
  const groups = byArea(card._areaGroups());
  assert.equal(groups.keuken.zone.id, "z1");
  assert.equal(groups.woonkamer.zone.id, "z2");
  // An area field pointing elsewhere wins over a matching name.
  const other = makeCard({ zones: { z1: zone("z1", "Keuken", { area: "garage" }) } });
  assert.equal(byArea(other._areaGroups()).keuken.zone, null);
});

test("a room is expanded after a tap or in its own camera view", () => {
  const card = makeCard({ views: { Keuken: { position: [0, 0, 0], target: [0, 0, 0] }, Bank: { position: [0, 0, 0], target: [0, 0, 0], area: "woonkamer" } } });
  let groups = byArea(card._areaGroups());
  assert.equal(groups.keuken.expanded, false);
  card._toggleAreaExpanded("keuken");
  assert.equal(byArea(card._areaGroups()).keuken.expanded, true);
  card._toggleAreaExpanded("keuken");
  card._activeModelView = "Keuken";
  groups = byArea(card._areaGroups());
  assert.equal(groups.keuken.expanded, true);
  assert.equal(groups.woonkamer.expanded, false);
  card._activeModelView = "Bank";
  assert.equal(byArea(card._areaGroups()).woonkamer.expanded, true);
});

test("room totals colour the matching zones", () => {
  const card = makeCard({ zones: { z1: zone("z1", "Keuken") } });
  assert.deepEqual(card._activeAreaHighlights(), [{ zoneId: "z1", color: "#e53935" }]);
});

test("min_value hides small readings but they still count", () => {
  const card = makeCard({ layers: [{ id: "energy", device_classes: ["power"], group_by_area: true, min_value: 1 }] });
  const layer = card._layerById("energy");
  assert.equal(card._isBelowLayerMinimum(ROWS.find((item) => item.key === "sensor.tv_power"), layer), true);
  assert.equal(card._isBelowLayerMinimum(ROWS.find((item) => item.key === "sensor.fridge_power"), layer), false);
  assert.equal(card._isBelowLayerMinimum(ROWS.find((item) => item.key === "sensor.kettle_power"), layer), false);
  assert.equal(byArea(card._areaGroups()).woonkamer.total, 0.4);
});

// --------------------------------------------------------- show_all_layer
test("with show_all_layer: false, 'All' falls back to the default or first layer", () => {
  const card = makeCard({ config: { show_all_layer: false } });
  card._activeLayer = "lights";
  card._setActiveLayer("");
  assert.equal(card._activeLayer, "energy");
  card._config.default_layer = "lights";
  card._activeLayer = "energy";
  card._setActiveLayer("all");
  assert.equal(card._activeLayer, "lights");
});

test("Edit Mode can still show all markers when 'All' is hidden", () => {
  const card = makeCard({ config: { show_all_layer: false } });
  card._mode = "edit";
  card._setActiveLayer("");
  assert.equal(card._activeLayer, "");
});

test("the navigation card leaves 'All' out when it is hidden", () => {
  const Nav = defined.get("home-assistant-3d-floorplan-nav");
  assert.ok(Nav, "nav card is defined");
  const nav = Object.create(Nav.prototype);
  nav._config = { target: "", show: ["layers"] };
  nav._hass = null;
  const layers = [{ id: "energy", name: "Energy", icon: "mdi:flash" }];
  nav._state = { floors: [], layers, activeLayer: "energy", views: [], showAllLayer: false };
  assert.deepEqual(nav._groups()[0].items.map((item) => item.value), ["energy"]);
  nav._state = { ...nav._state, showAllLayer: true };
  assert.deepEqual(nav._groups()[0].items.map((item) => item.value), ["", "energy"]);
});
