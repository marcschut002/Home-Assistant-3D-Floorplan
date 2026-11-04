// Tests for layer_entities: one marker per device that shows a different sensor
// of that device while a layer is active.
//
// Same approach as navigate-action.test.mjs: stub just enough DOM to import the
// card, then exercise methods on a bare prototype.
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
    deviceId: "hall_sensor",
    domain,
    domains: [domain],
    deviceClasses: extra.deviceClass ? [extra.deviceClass] : [],
    primaryDomain: domain,
    primaryDeviceClass: extra.deviceClass || "",
    primaryState: extra.state ?? "on",
    unit: extra.unit || "",
    offline: false,
    ...extra,
  };
}

const ROWS = [
  row("binary_sensor.hall_motion", { deviceClass: "motion" }),
  row("sensor.hall_temperature", { deviceClass: "temperature", state: "16.7", unit: "°C" }),
  row("sensor.hall_illuminance", { deviceClass: "illuminance", state: "40", unit: "lx" }),
  row("sensor.other_power", { deviceClass: "power", deviceId: "other_plug", state: "1.6", unit: "W" }),
];

function makeCard(markers = {}, overrides = {}) {
  const card = Object.create(Card.prototype);
  card._config = { offline_states: ["unavailable", "unknown"] };
  card._mode = "user";
  card._activeLayer = "";
  card._activeFloorId = "default";
  card._selectedMarkers = new Set();
  card._history = 0;
  card._markers = card._normalizedMarkers(markers);
  card._floorMarkers = { default: card._markers };
  card._layers = card._normalizedLayers([
    { id: "motion", name: "Motion", device_classes: ["motion"] },
    { id: "climate", name: "Climate", device_classes: ["temperature"] },
    { id: "light", name: "Light", device_classes: ["illuminance"] },
  ]);
  card._deviceRows = () => ROWS;
  card._pushMarkerHistory = () => { card._history += 1; };
  card._saveMarkers = () => {};
  card._refresh3DMarkerOverlay = () => {};
  card._refreshDeviceRow = () => {};
  card._refreshSelectedMarkerPanel = () => {};
  return Object.assign(card, overrides);
}

const rowByKey = new Map(ROWS.map((item) => [item.key, item]));
const motion = rowByKey.get("binary_sensor.hall_motion");
const placed = (entityId, extra = {}) => ({ [entityId]: { entityId, x: 1, y: 2, z: 3, ...extra } });

// ----------------------------------------------------------- normalisation
test("layer_entities keeps valid layer ids and entity ids only", () => {
  const card = makeCard();
  assert.deepEqual(
    card._normalizeLayerEntities({ Climate: "sensor.hall_temperature", light: "not an entity", "": "sensor.x" }),
    { climate: "sensor.hall_temperature" },
  );
  assert.deepEqual(card._normalizeLayerEntities(["sensor.x"]), {});
  assert.deepEqual(card._normalizeLayerEntities(undefined), {});
});

test("layer_entities is read from YAML markers", () => {
  const card = makeCard();
  const markers = card._markersFromList([
    { entity: "binary_sensor.hall_motion", x: 1, y: 2, z: 3, layer_entities: { climate: "sensor.hall_temperature" } },
  ]);
  assert.deepEqual(markers["binary_sensor.hall_motion"].layerEntities, { climate: "sensor.hall_temperature" });
});

test("layer_entities saved as a JSON string by older exports still works", () => {
  const card = makeCard();
  assert.deepEqual(card._normalizeLayerEntities('{"energy":"sensor.aanrecht_power"}'), { energy: "sensor.aanrecht_power" });
  assert.deepEqual(card._normalizeLayerEntities("not json"), {});
});

test("layer_entities is exported as a nested block that the editor's YAML reader understands", () => {
  const card = makeCard();
  const lines = card._yamlLayerEntityLines({ energy: "sensor.aanrecht_power", klimaat: "sensor.temp" }, "    ");
  assert.deepEqual(lines, ["    layer_entities:", "      energy: sensor.aanrecht_power", "      klimaat: sensor.temp"]);
  const Editor = defined.get("home-assistant-3d-floorplan-editor");
  const editor = Object.create(Editor.prototype);
  const parsed = editor._parseFullYaml(["markers:", "  - entity: light.aanrecht", ...lines].join("\n"));
  assert.deepEqual(parsed.markers[0].layer_entities, { energy: "sensor.aanrecht_power", klimaat: "sensor.temp" });
});

// ------------------------------------------------------------------ display
test("All shows the primary sensor", () => {
  const card = makeCard(placed("binary_sensor.hall_motion", { layerEntities: { climate: "sensor.hall_temperature" } }));
  assert.equal(card._markerDisplayRow(motion, rowByKey), motion);
});

test("a layer with a layer sensor shows that sensor under the marker's key", () => {
  const card = makeCard(placed("binary_sensor.hall_motion", { layerEntities: { climate: "sensor.hall_temperature" } }));
  card._activeLayer = "climate";
  const shown = card._markerDisplayRow(motion, rowByKey);
  assert.equal(shown.key, "binary_sensor.hall_motion");
  assert.equal(shown.entityId, "sensor.hall_temperature");
  assert.equal(shown.layerEntityOf, "binary_sensor.hall_motion");
  assert.equal(card._formatMarkerValue(shown), "16.7°C");
  assert.equal(card._isMarkerFilteredOut(motion), false);
});

test("a layer sensor makes the marker part of that layer, even when the primary is left out", () => {
  const card = makeCard(placed("binary_sensor.hall_motion", {
    layerEntities: { motion: "sensor.hall_illuminance" },
    excludedLayers: ["motion"],
  }));
  assert.equal(card._isMarkerInLayer(motion, "motion"), true);
  assert.equal(card._isPrimaryInLayer(motion, "motion"), false);
});

test("a layer without a sensor still hides the marker when the primary is not in it", () => {
  const card = makeCard(placed("binary_sensor.hall_motion"));
  card._activeLayer = "light";
  assert.equal(card._isMarkerFilteredOut(motion), true);
});

test("the primary's icon and tap action do not carry over to a layer sensor", () => {
  const card = makeCard(placed("binary_sensor.hall_motion", {
    icon: "mdi:walk",
    tapAction: "toggle",
    layerEntities: { climate: "sensor.hall_temperature" },
  }));
  card._config.marker_tap_action = "auto";
  card._activeLayer = "climate";
  const shown = card._markerDisplayRow(motion, rowByKey);
  assert.notEqual(card._markerIcon(shown), "mdi:walk");
  assert.notEqual(card._effectiveMarkerAction(shown, "tap"), "toggle");
});

// ------------------------------------------------------------------ editing
test("sensor candidates are the other entities of the same device", () => {
  const card = makeCard();
  assert.deepEqual(
    card._layerEntityCandidates(motion).map((item) => item.entityId),
    ["sensor.hall_temperature", "sensor.hall_illuminance"],
  );
});

test("auto-fill picks a matching sensor for every layer the primary is not in", () => {
  const card = makeCard(placed("binary_sensor.hall_motion"));
  card._autofillLayerEntities("binary_sensor.hall_motion");
  assert.deepEqual(card._markers["binary_sensor.hall_motion"].layerEntities, {
    climate: "sensor.hall_temperature",
    light: "sensor.hall_illuminance",
  });
  assert.equal(card._history, 1);
});

test("choosing a sensor that has its own marker removes that marker", () => {
  const card = makeCard({ ...placed("binary_sensor.hall_motion"), ...placed("sensor.hall_temperature") });
  card._setLayerEntity("binary_sensor.hall_motion", "climate", "sensor.hall_temperature");
  assert.equal(card._markers["sensor.hall_temperature"], undefined);
  assert.equal(card._markers["binary_sensor.hall_motion"].layerEntities.climate, "sensor.hall_temperature");
});

test("clearing a layer sensor removes it from layer_entities", () => {
  const card = makeCard(placed("binary_sensor.hall_motion", { layerEntities: { climate: "sensor.hall_temperature" } }));
  card._setLayerEntity("binary_sensor.hall_motion", "climate", "");
  assert.deepEqual(card._markers["binary_sensor.hall_motion"].layerEntities, {});
});

test("merging a separate marker fills its layers and removes it", () => {
  const card = makeCard({ ...placed("binary_sensor.hall_motion"), ...placed("sensor.hall_temperature") });
  card._mergeMarkerInto("binary_sensor.hall_motion", "sensor.hall_temperature");
  assert.equal(card._markers["sensor.hall_temperature"], undefined);
  assert.deepEqual(card._markers["binary_sensor.hall_motion"].layerEntities, { climate: "sensor.hall_temperature" });
});

test("make primary moves the marker to the new entity and keeps the old one in its layer", () => {
  const card = makeCard(placed("binary_sensor.hall_motion", {
    icon: "mdi:walk",
    layerEntities: { climate: "sensor.hall_temperature", light: "sensor.hall_illuminance" },
  }));
  card._selectedMarkers.add("binary_sensor.hall_motion");
  card._makeLayerEntityPrimary("binary_sensor.hall_motion", "climate");
  assert.equal(card._markers["binary_sensor.hall_motion"], undefined);
  const marker = card._markers["sensor.hall_temperature"];
  assert.equal(marker.entityId, "sensor.hall_temperature");
  assert.equal(marker.icon, "");
  assert.deepEqual([marker.x, marker.y, marker.z], [1, 2, 3]);
  assert.deepEqual(marker.layerEntities, { light: "sensor.hall_illuminance", motion: "binary_sensor.hall_motion" });
  assert.deepEqual([...card._selectedMarkers], ["sensor.hall_temperature"]);
  assert.equal(card._floorMarkers.default, card._markers);
});

test("entities shown by a marker are left out of the Add list", () => {
  const card = makeCard(placed("binary_sensor.hall_motion", { layerEntities: { climate: "sensor.hall_temperature" } }));
  card._filteredRows = (rows) => rows;
  card._filters = { domain: "all" };
  card._showAllEntityTypes = true;
  const add = card._markerListRows(ROWS).add.map((item) => item.entityId);
  assert.deepEqual(add, ["sensor.hall_illuminance", "sensor.other_power"]);
});
