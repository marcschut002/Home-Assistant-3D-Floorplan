# Home Assistant 3D Floorplan

![Home Assistant 3D Floorplan preview](images/preview.png)

A Lovelace custom card for placing Home Assistant entities on a 3D model and rendering physically-based lighting directly in the browser. Load a `.glb`, switch to Edit Mode, select an entity from the sidebar, click the model to place it, then configure lighting zones and light types for a realistic room render.

The card element is `custom:home-assistant-3d-floorplan`.

## Install

Add this JavaScript resource in Home Assistant:

```yaml
url: /local/Home-Assistant-3D-Floorplan.js
type: module
```

If installed through HACS:

```yaml
url: /hacsfiles/Home-Assistant-3D-Floorplan/Home-Assistant-3D-Floorplan.js
type: module
```

## Basic Card

```yaml
type: custom:home-assistant-3d-floorplan
title: 3D Floorplan
model: /local/floorplans/home.glb
view_mode: "3d"
markers: []
```

In Edit Mode, set **Model Background Mode** to **Transparent** to show the Home
Assistant card background behind the 3D model. In YAML, use:

```yaml
model_background: transparent
```

## Coordinate System

The card uses the standard Three.js / GLTF coordinate convention:

- **X** - east/west floor axis
- **Y** - vertical (height)
- **Z** - north/south floor axis

This matches `.glb` files exported from Blender with the default Y-up orientation. No `coordinate_map` override is needed for standard exports.

## Markers

Marker colors reflect live entity state:

- Red: unavailable or unknown
- Yellow: active / on / open / detected
- Dark: inactive / off / closed / clear
- Green: available neutral state

Default press actions:

```yaml
marker_tap_action: auto
marker_hold_action: auto
edit_marker_tap_action: select
edit_marker_hold_action: move
marker_hold_ms: 650
```

`auto` uses domain defaults - lights and switches toggle on tap; sensors, binary sensors, and climate entities open more-info. Edit Mode is shown only when `hass.user.is_admin === true`.

Markers export as:

```yaml
markers:
  - entity: light.kitchen
    name: Kitchen Light
    icon: mdi:lightbulb
    tap_action: toggle
    hold_action: more-info
    light_intensity: 100
    light_type: spot
    light_radius: 120
    x: 850.0000
    y: 230.0000
    z: 610.0000
```

Temperature and humidity sensors show their live value on the marker. Use **Marker display** in Edit Mode to force icon or value display:

```yaml
marker_display: value   # auto | icon | value | hide
```

### Visible in Views
Show a marker only while one of the listed named camera views is active. Use
`default` for the startup (**Home**) view. Without `visible_in_views` the marker is
always shown.

```yaml
visible_in_views: [kitchen, living_room]
```

The active view changes only when another view is chosen, through a view icon,
the play button in the editor's Views mode, or `hafp_view` in the URL. Orbiting or zooming
the camera keeps the current view active. When the card loads, `default` is active.
In Edit Mode, markers that are hidden for the current view appear faded. Tick the
views under **Visible in views** in the marker panel.

### Color Thresholds

Use `color_thresholds` to color a marker dynamically based on its numeric state value. This is particularly useful for temperature, humidity, CO₂, or any sensor with a continuous numeric reading.

```yaml
markers:
  - entity: sensor.living_room_temperature
    name: Living Room
    marker_display: value
    color_thresholds:
      - value: 18
        color: "#42a5f5"   # blue  — cold
      - value: 22
        color: "#66bb6a"   # green — comfortable
      - value: 26
        color: "#ef5350"   # red   — hot
```

**Threshold logic (step, not interpolated):**

- State **below** the first threshold → first threshold color
- State **between** two thresholds → color of the lower threshold
- State **at or above** the last threshold → last threshold color

So for the example above: values below 18 are blue, 18–21.9 are blue, 22–25.9 are green, and 26+ are red.

`color_thresholds` works in both 2D (floorplan image) and 3D model view, and accepts any valid CSS color (`#hex`, `rgb()`, named colors). When the entity is offline or unavailable, the standard red offline styling takes precedence.

In Edit Mode, select a numeric sensor marker and use **Color thresholds** in the marker settings panel to add, edit, or remove threshold rows.

## Navigation Card

`custom:home-assistant-3d-floorplan-nav` is a second card, shipped in the same file,
with buttons for the floors, layers and views of a floorplan card on the same
dashboard. Place it above, below or next to the floorplan card. It fills itself from
the floorplan card, so there is nothing to retype: new views and layers appear on
their own, and the active floor, layer and view are highlighted, however they were
chosen. Views follow the active floor.

```yaml
# next to the floorplan
type: custom:home-assistant-3d-floorplan-nav
show: [floors, layers]
layout: vertical

# above or below the floorplan
type: custom:home-assistant-3d-floorplan-nav
show: [views]
layout: horizontal
align: center
```

| Option | Default | Description |
| --- | --- | --- |
| `show` | `[floors, layers, views]` | Which groups to show, in this order. A group with nothing to choose (one floor, no layers, no views) is left out. |
| `style` | `buttons` | `buttons`, or `dropdown` for one compact select per group. Dropdowns use the phone's own picker, which suits mobile. |
| `layout` | `vertical` | `vertical` stacks the groups; `horizontal` puts them in one row (round buttons, or dropdowns side by side that wrap on narrow screens). |
| `align` | `start` | `start`, `center` or `end`; horizontal layout only. |
| `show_names` | `true` | `false` shows icons only. |
| `show_titles` | `true` | Group titles in the vertical layout. |
| `target` | | The floorplan card's `storage_key`, or else its `title`. Only needed with several floorplan cards on one dashboard; without it the first one found is used. |
| `labels` | | Your own labels: `floors`, `layers`, `views` (group titles), `all` (the all-layers button) and `home` (the Home view). Anything left out follows the Home Assistant language. |

The navigation card and the floorplan's layer switcher follow the language of your
Home Assistant profile: Dutch (Verdieping, Laag, Weergave, Alles, Thuis) or English
for any other language. To pick your own words (older configs with `texts:`,
`labels: false` and `titles:` keep working):

```yaml
type: custom:home-assistant-3d-floorplan-nav
labels:
  floors: Etage
  views: Ruimtes
```

For a different navigation on phones, add two navigation cards and give each a
**Screen** visibility condition in the card's Visibility tab: the dropdown card for
mobile widths, the button card for wider screens.

```yaml
type: custom:home-assistant-3d-floorplan-nav
style: dropdown
layout: horizontal
show: [floors, layers, views]
```

A card with nothing to show, such as a views card on a floor without views, hides
itself; while editing the dashboard it shows why instead. The same goes for a
navigation card that has not found its floorplan card yet: it keeps looking every
second, and again when the page wakes up, so the order in which the cards load does
not matter. Set
`show_layer_switcher: false` on the floorplan card to drop its built-in layer buttons
when a navigation card shows the layers.

## Layers

Layers group markers so you can switch between, for example, lighting, climate and
energy. When `layers` is set, a switcher appears in the bottom-left corner of the
model with **All** plus one button per layer. Click the active layer again to go
back to **All**.

```yaml
default_layer: lighting        # optional, defaults to All
layers:
  - id: lighting
    name: Lighting
    icon: mdi:lightbulb-group
    domains: [light]
    marker_display: icon       # show lights even if their marker is set to hide
  - id: climate
    name: Climate
    icon: mdi:thermostat
    domains: [climate, fan]
    device_classes: [temperature, humidity]
  - id: energy
    name: Energy
    icon: mdi:flash
    device_classes: [power]
    marker_display: value      # show the live reading on each marker
```

A marker belongs to a layer when its domain, device class or entity is listed in
the layer (`domains`, `device_classes`, `entities`). You can also add it by hand:

```yaml
markers:
  - entity: switch.bathroom_heater
    layers: [climate]
```

To keep a marker out of a layer it matches automatically, for example one lamp you
never want to see, exclude it:

```yaml
markers:
  - entity: light.wc
    marker_display: hide
    exclude_layers: [lighting]
```

In Edit Mode, the marker panel lists all layers under **Layers**. Layers that the
marker matches automatically are marked *(auto)*; click such a chip to leave the
marker out of that layer (it then reads *(left out)*), and click again to add it back.

While a layer is selected, only its markers are shown. The marker's own `hide`
setting and `visible_in_views` are ignored, so a lighting layer can show lights
whose icons are normally hidden. A layer's `marker_display` (`icon` or `value`)
overrides the marker setting while that layer is active. With **All** selected,
markers behave as they normally do.

Select a layer from another card with `hafp_layer`. Use `hafp_layer=all` to go
back to **All**. It combines with `hafp_floor` and `hafp_view`:

```yaml
tap_action:
  action: navigate
  navigation_path: "#hafp_floor=ground&hafp_view=start&hafp_layer=energy"
```

Set `show_layer_switcher: false` to hide the built-in switcher and use your own
buttons instead. A link without `hafp_layer` keeps the current layer.

Layers can also be managed in the visual card editor under **Layers**, where the
arrow buttons set their order in the navigation card and the layer switcher.

## Named Camera Views

Define additional 3D camera views next to `default_view`. A view name can then be
opened from another Lovelace card with a normal Home Assistant `navigate` action:

```yaml
views:
  kitchen:
    position: [6.2500, 4.5000, 8.7500]
    target: [0.0000, 0.8000, 0.0000]
    zoom: 1.0000
  living_room:
    position: [-4.0000, 3.5000, 6.0000]
    target: [1.0000, 0.8000, 0.0000]
```

Navigate to the card's dashboard view with `hafp_view` in the URL:

```yaml
tap_action:
  action: navigate
  navigation_path: "#hafp_view=kitchen"
```

Combine both parameters to select a floor and a view:

```yaml
tap_action:
  action: navigate
  navigation_path: "#hafp_floor=first&hafp_view=living_room"
```

`hafp_floor` must match the floor `id`, not its display name.
The hash format keeps the current Lovelace page in place and avoids a route refresh.

For multiple floors, put `views` inside the relevant floor. The named view is
applied after the model loads and can also be changed while the card is open.

### View Icons
Give a view an `icon` to show a clickable icon in the 3D model. Clicking the icon
moves the camera to that view. The icon then fades out over one second and stays
hidden while that view is active. It reappears when you choose another view.

```yaml
views:
  kitchen:
    position: [6.2500, 4.5000, 8.7500]
    target: [0.0000, 0.8000, 0.0000]
    icon: mdi:silverware-fork-knife
    icon_position: [1.2000, 1.0000, -0.5000]   # optional, defaults to target
    icon_color: "#ff9800"                       # optional, defaults to the theme primary color
    icon_on_model: false                        # optional: only use the icon in the navigation card and lists
```

In the editor's **Views** mode, open a view and choose a **View icon** and optionally
an **Icon color** (**Theme Color** resets it). Turn off **Show icon on model** to use
the icon only in the navigation card and lists. Otherwise use **Pick on Model** to click
where the icon should appear, or **Use Target** to place it at the view target.
Press **Save view** to keep the icon.

## Edit Mode

The card has no edit buttons during normal use. Admins open the full-screen
editor from Home Assistant's own dashboard editing:

- **Masonry and panel dashboards** - while the dashboard is being edited, the card
  shows **Markers**, **Areas** and **Views** buttons.
- **Sections dashboards** - Home Assistant blocks clicks on cards while editing, so
  open the card's editor (pencil) and use the buttons under **Edit Layout**.

The editor opens full screen with the same three buttons at the top to switch
between markers, areas and views. Close it with **✕** or **Esc** to go back. If
something is still pending, such as a marker you are placing, the first Esc cancels
that and the second closes the editor. Changes are saved in the browser as you make
them. When the editor closes, other copies of the card on the page reload the new
layout.

When you opened the editor from the card editor (the pencil), closing it writes the
changed markers, brightness areas, views and Home view into the card config. Press
**Save** in the card editor to keep them, so no YAML export is needed. If nothing
changed, the config is left alone. Other per-floor settings, such as animations,
stay as they are. When the editor was opened from the buttons on the card (masonry
and panel dashboards), use **Export YAML** in the sidebar as before.

The sidebar header shows the current floor, with a floor picker when the card has
more than one floor. In each mode, only that mode's items respond to clicks in the
model. The others are dimmed.

**Markers** - the sidebar has two lists:
- **On map** - the markers on this floor, grouped by area. Click a row to select the
  marker and open its panel. The crosshair button flies the camera to it. Small icons
  show markers that are hidden or limited to some views.
- **Add** - entities that are not placed yet. Click one, then click the model to place
  it. **Filters & placement** holds the availability, domain, integration and area
  filters and the placement mode. Automations, scripts, helpers and other system
  entities are left out unless you turn them on there.

With layers configured, a **Layer** picker filters both lists and the model. **No
layer** shows markers that are in no layer yet. In **Add**, entities that match the
layer come first. Placing one of the others adds it to the layer.

**Areas** - a list of brightness areas. **Add area** starts a new one in drawing
mode. Click an area to edit it, and use ← to go back to the list.

**Views** - a list with the Home (startup) view and your named views. **New view**
starts from the current camera. Click a view to edit its name, camera and icon,
and use **Preview** to fly to the edited camera. Renaming a view replaces the old
one in the same place. The play button on a row goes to that view, and the arrow
buttons move it up or down. That order is used everywhere: the navigation card, the
marker panel and the `views:` section of the YAML (views are listed in that order).
A view whose name is a whole number, such as `1`, always sorts first, so give views
a word as name.

**Marker panel** - selecting a placed marker opens a panel on the right. Its
settings are grouped in collapsible sections, each showing a short summary when
closed:
- **Appearance** - icon, marker display (auto, icon, value or hide) and color thresholds
- **Visibility** - views and layers, as chips you click on or off
- **Actions** - tap and hold actions, plus a navigation path when either is set to Navigate
- **Light** - intensity, type, radius and render parameters (for `light.*` entities)
- **Position** - X/Y/Z coordinates and **Move on model**

**Remove marker** is at the bottom. Close the panel with ✕ or Esc.

<img src="images/Marker%20Settings.png" alt="Marker settings panel" width="350" />

**Axes gizmo** - a small XYZ orientation indicator appears in the top-left corner in Edit Mode, showing how the model axes relate to the camera.

**Export YAML** - the sidebar exports the full card YAML with current marker positions, zone definitions, and presets. Press **Copy YAML** to copy it to the clipboard.

## Camera Views

The Home view is the camera position the card starts in. Set it in the editor's
**Views** mode: the **Home** row at the top of the list can save the current camera,
clear it, or go to it. Without a Home view the camera fits the whole model. The
Home view is stored per floor and is written to the YAML export:

```yaml
default_view:
  position: [6.2500, 4.5000, 8.7500]
  target: [0.0000, 0.8000, 0.0000]
  zoom: 1.0000
```

## Brightness Areas (Lighting Zones)

Edit Mode can define room polygons that drive the 3D lighting render. Press **Add Area**, then **Draw**, and click the floor to trace the room boundary.

### Lighting Modes

Each zone has two modes, selectable in the zone settings:

**Area (zone-wide glow)** - a single flat ambient fill covers the whole floor polygon. Suitable for zones with diffuse overhead lighting or when no individual light positions are needed.

![Area glow mode](images/Area_Glow.png)

**Positional (per-light pools)** - each `light.*` marker placed inside the zone creates its own floor pool, wall glow, ceiling glow, and GI bounce based on its position and light type.

![Positional lighting mode](images/Positional.png)

### Zone Settings

```yaml
brightness_zones:
  - id: living-room
    name: Living Room
    color: "#f8d66d"
    height: 280
    floor_offset: 0
    day_opacity: 0.50
    night_opacity: 1.00
    lighting_mode: positional
    illuminance_enabled: true
    illuminance_entity: sensor.living_room_lux
    show_lux: true
    points:
      - x: 100.0000
        y: -300.0000
      - x: 900.0000
        y: -300.0000
      - x: 900.0000
        y: -1100.0000
```

**Illuminance sensor** - when enabled, the shade is driven dynamically by a lux sensor. Low lux approaches night shade; 300 lux reaches day shade; brighter reduces shade further. The sensor is selected from a searchable dropdown of all `sensor.*` and `input_number.*` entities. Falls back to `sun.sun` day/night when disabled or sensor is unavailable.

**Floor Offset** - the zone's floor plane always sits at the model's vertical origin (0) by default. For an upper floor whose model geometry starts higher up (e.g. a mezzanine at 2.5m), set **Floor Offset** in the zone settings (or `floor_offset` in YAML) to raise the zone's floor, wall glow, and ceiling calculations to the correct elevation.

## Light Types (Positional Mode)

Each `light.*` marker in a Positional zone has a **Light type** that controls how the glow is rendered on floors, walls, and ceilings.

| Type | Description |
|---|---|
| **Spot** | Ceiling downlight. Renders a cone on the wall with inner/outer angle, a bright floor hotspot, and GI bounce. Supports tilt X/Y to aim off-center. |
| **Cove** | Indirect ceiling bounce. Produces a top-heavy wall wash that fades downward and a soft uniform floor fill centered on the zone. |
| **Linear** | LED strip. Elongated floor pool; wall wash runs the length of the strip path. |
| **Lamp** | Floor or table lamp. Tight floor pool, soft wall glow radiating outward. |

Set **Light radius** to override the auto-computed pool size (in model units). Leave blank for automatic sizing based on mount height and zone dimensions.

### Light Paths (Linear / Cove)

Linear and Cove lights support a drawn path that distributes sample points along the strip:

- **Draw line** - click the 3D model to add path points one by one
- **Rectangle** - define width, depth, and rotation; the card generates a closed 4-corner loop automatically. The marker position becomes the rectangle center.

### Sub-spots (Spot)

A spot marker can contain multiple render-only sub-spots - extra light positions that share the parent entity state but each have their own XYZ position and render parameters. Useful for a single HA entity that controls a row of ceiling spots.

## Render Parameters

Every light marker has a full set of render parameters accessible in the **Advanced** section of the floating panel. Parameters are grouped into four sections:

### Core
| Param | Description |
|---|---|
| `intensity` | Overall brightness multiplier |
| `distance` | How far the light reaches - affects wall reach and floor pool size |
| `decay` | Falloff speed. Low = soft wide wash. High = sharp tight edge |

### Light Shape
| Param | Applies to | Description |
|---|---|---|
| `angle` | Spot | Cone half-angle in radians. Smaller = narrower beam |
| `penumbra` | Spot | Softness of cone edge. 0 = hard cut, 1 = fully feathered |
| `tilt_x` | Spot, Linear, Cove | Tilts the light in the X floor direction |
| `tilt_y` | Spot, Linear, Cove | Tilts the light up/down |
| `width` | Linear, Cove | Width of the rectangular light source |
| `height` | Linear, Cove | Height of the rectangular light source |

### Floor Pool
| Param | Description |
|---|---|
| `floor_hotspot_size` | Size of the bright core relative to the main pool. Most effective on Spot, Lamp |
| `floor_saturation` | Color saturation of the floor glow. 0 = grey, 1.5 = vivid |
| `floor_outer_size` | Radius multiplier of the wide ambient scatter layer |
| `floor_outer_brightness` | Brightness of the outer scatter layer |
| `gi_brightness` | GI bounce intensity - secondary soft floor fill. 0 = disabled |
| `gi_radius` | Radius multiplier of the GI bounce mesh |
| `gi_warmth` | Warms the GI bounce color to simulate warm floor reflection |

### Wall Glow
| Param | Description |
|---|---|
| `wall_intensity_scale` | Multiplier for overall wall glow brightness |
| `wall_height_limit` | Fraction of zone height the wall mesh covers. 1.0 = full wall |
| `wall_lower_bias` | Shifts glow center down the wall. 0 = near fixture, 1 = near floor |

Hovering over any parameter value shows a tooltip with a description and which light types it is most effective on.

### Presets

Parameter sets can be saved as named presets and reused across lights:

- **Save as preset** - prompts for a name and stores the current resolved values
- **Reset** - clears all per-light overrides and returns to type defaults
- **Export** - downloads the resolved parameters as a `.json` file
- **Import** - loads a previously exported `.json` and applies it to the current light

Presets are saved to `localStorage` and survive JavaScript file updates. The YAML export also includes the `light_presets:` block so they can be committed to the card config:

```yaml
light_presets:
  narrow_spot:
    angle: 0.25
    penumbra: 0.3
    wall_intensity_scale: 1.2
```

Per-light overrides and preset assignments export with the marker:

```yaml
markers:
  - entity: light.hallway_spot
    light_type: spot
    light_preset: narrow_spot
    render_params:
      tilt_x: 15
      wall_lower_bias: 0.2
    x: 500.0000
    y: 230.0000
    z: 400.0000
```

## Floor and Ceiling Glow Clipping

All floor pools, ceiling glows, and GI bounce meshes are clipped to the zone polygon boundary. Light cannot bleed through walls into adjacent rooms regardless of pool radius.

## Multiple Floors

```yaml
type: custom:home-assistant-3d-floorplan
title: Home Floorplan
view_mode: "3d"
floors:
  - id: ground
    name: Ground Floor
    icon: mdi:home-floor-0
    model: /local/floorplans/ground-floor.glb
    markers: []
    brightness_zones: []
  - id: first
    name: First Floor
    icon: mdi:home-floor-1
    model: /local/floorplans/first-floor.glb
    markers: []
    brightness_zones: []
```

`icon` is optional and shows on the floor buttons of the navigation card (without
it, a stairs icon). In the card editor, open a floor under **Floors** and fill in
**Icon**. The arrow buttons next to each floor change the order; its markers, areas
and views move with it.

## Offline / Three.js Setup

### What is and isn't local by default

When you install via HACS or manually, the card file (`Home-Assistant-3D-Floorplan.js`) is stored locally on your Home Assistant instance. Your `.glb` model is also served from your local `/www/` folder.

When installed through HACS, the card first loads the bundled Three.js build from the HACS-served files:

```yaml
three_bundle_urls:
  - /hacsfiles/Home-Assistant-3D-Floorplan/dist/three.bundle.min.js
  - /local/three.bundle.min.js
```

If those bundle paths are unavailable, the card falls back to the external CDN `esm.sh`:

```yaml
three_url: "https://esm.sh/three@0.165.0"   # default - requires internet
```

The bundled HACS path avoids remote-access and Companion App issues caused by blocked external module imports.

### Making it fully offline (recommended)

The repository includes a pre-built bundle at `dist/three.bundle.min.js`. Copy it to your Home Assistant `www` folder:

```
/config/www/three.bundle.min.js
```

Then point the card at it if you are not using HACS:

```yaml
type: custom:home-assistant-3d-floorplan
title: 3D Floorplan
model: /local/floorplans/home.glb
three_bundle_urls:
  - /local/three.bundle.min.js
```

With this in place, **everything runs 100% offline** - no external requests, no CDN dependency. This also fixes loading issues in the Home Assistant Companion App on iOS/Android, which can block remote module imports.

### Alternative - host individual Three.js files

If you prefer to host the individual modules rather than the bundle:

```yaml
three_url: /local/vendor/three/three.module.js
gltf_loader_url: /local/vendor/three/GLTFLoader.js
obj_loader_url: /local/vendor/three/OBJLoader.js
orbit_controls_url: /local/vendor/three/OrbitControls.js
```

Use matching files from Three.js release `0.165.0`.

## Animated 3D Objects

Animate mesh objects in your GLB model based on Home Assistant entity state. Name your objects in Blender (or your 3D editor), then reference them by name in the card config.

These settings can be managed from the Home Assistant visual card editor under **Animated 3D Objects**. Use **Configuration scope** to edit a single-floor card or a specific floor in a multi-floor card.

### Configuration

Add an `animations` array at the top level (single-floor) or inside each floor entry (multi-floor):

```yaml
type: custom:home-assistant-3d-floorplan
title: 3D Floorplan
model: /local/floorplans/home.glb
animations:
  - object_name: "CeilingFan"
    entity: fan.kitchen_ventilador_cocina
    type: rotate
    axis: y
    speed: 2.0
  - object_name: "Pump_PB"
    entity: binary_sensor.hcc_planta_baja_pump
    type: rotate
    axis: z
    speed: 1.0
```

Multi-floor example:

```yaml
floors:
  - id: ground
    name: Ground Floor
    model: /local/floorplans/ground.glb
    animations:
      - object_name: "WaterValve"
        entity: switch.water_valve
        type: oscillate
        axis: z
        speed: 0.5
        amplitude: 0.8
```

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `object_name` | Yes | — | Name of the mesh/object in the GLB file (as named in Blender) |
| `entity` | Yes | — | Home Assistant entity ID that controls the animation |
| `type` | No | `rotate` | Animation type: `rotate`, `oscillate`, or `bob` |
| `axis` | No | `y` | Rotation/movement axis: `x`, `y`, or `z` |
| `speed` | No | `1.0` | Speed multiplier (rotations/cycles per second) |
| `state_on` | No | `"on"` | Entity state value that triggers the animation |
| `amplitude` | No | `0.5` | For `oscillate`: max rotation in radians. For `bob`: max displacement in model units |

### Animation Types

- **`rotate`** — Continuous rotation around the specified axis. Good for fans, turbines, pumps.
- **`oscillate`** — Rocks back and forth around the axis. Good for valves, pendulums, indicators.
- **`bob`** — Moves up and down (or along the specified axis). Good for floating indicators or pistons.

### Tips

- The object name in the config must match the object name in your 3D file exactly (case-sensitive).
- Set the object's origin point in Blender to the desired center of rotation before exporting.
- For fans, place the origin at the center of the fan blades and use `type: rotate` with `axis: y`.
- Animations only run when the entity state matches `state_on`. When the state changes to anything else, the object stops in its current position.
- Multiple animations can target different objects in the same model.
- **Geometry centering**: The card automatically centers each animated mesh's geometry around its local origin before animating. This ensures rotation happens in-place even for models exported from Sweet Home 3D or other tools that bake world-space vertex positions.

### Note on Three.js Loading

The card loads Three.js from `esm.sh` by default, which rewrites bare import specifiers internally. This avoids the problem where `jsdelivr.net` CDN links for Three.js addons (GLTFLoader, OrbitControls) use bare `import "three"` specifiers that fail without a browser import map.

If your HA instance has no internet access, use the bundled offline approach (`three_bundle_url`) described in the installation section above.

## Interactive 3D Objects

Bind named meshes in your GLB model directly to Home Assistant entities. Clicking/tapping the 3D object fires an action (toggle, more-info, call-service), and the object's appearance can change based on entity state.

The visual card editor provides repeatable interactive-object and state-style controls, including tap/hold service actions. Use **Configuration scope** to edit a single-floor card or a specific floor in a multi-floor card.

### Configuration

Add an `interactive_objects` array at the top level or inside each floor:

```yaml
interactive_objects:
  - object_name: "CeilingFan"
    entity: fan.kitchen_ventilador_cocina
    tap_action: toggle
    hold_action: more-info
    state_styles:
      "on":
        color: "#81c784"
      "off":
        color: "#5f6570"
        opacity: 0.6
  - object_name: "GarageDoor"
    entity: cover.garage_door
    tap_action: more-info
```

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `object_name` | Yes | — | Name of the mesh/object in the GLB file |
| `entity` | Yes | — | Home Assistant entity ID |
| `tap_action` | No | `toggle` | Action on tap: `toggle`, `more-info`, `none`, or a call-service object |
| `hold_action` | No | `more-info` | Action on long press (650ms): `toggle`, `more-info`, `none`, or a call-service object |
| `state_styles` | No | — | Object mapping entity state values to visual styles |

### State Styles

Each key under `state_styles` is an entity state value. Supported style properties:

| Property | Description |
|----------|-------------|
| `color` | Hex color string to tint the object material (e.g. `"#ff0000"`) |
| `opacity` | Number 0–1, makes the object semi-transparent |

When the entity state changes to a value not listed in `state_styles`, the object reverts to its original material.

### Call-Service Action

For custom actions beyond toggle/more-info:

```yaml
interactive_objects:
  - object_name: "Thermostat"
    entity: climate.living_room
    tap_action:
      action: call-service
      service: climate.set_temperature
      data:
        temperature: 22
```

### Combining with Animations

An object can be both interactive AND animated. Use the same `object_name` in both arrays:

```yaml
animations:
  - object_name: "CeilingFan"
    entity: fan.kitchen
    type: rotate
    axis: y
    speed: 3.0

interactive_objects:
  - object_name: "CeilingFan"
    entity: fan.kitchen
    tap_action: toggle
    state_styles:
      "on":
        color: "#81c784"
      "off":
        color: "#5f6570"
```

This makes the fan spin when on AND lets you tap it to toggle, with a color tint indicating state.

### Tips

- The cursor changes to a pointer when hovering over interactive objects.
- Hold gesture uses the same duration as markers (`marker_hold_ms`, default 650ms).
- If the named object is a group/empty in Blender, all child meshes become clickable.
- State styles clone materials internally so shared materials on other objects are not affected.

## Performance Notes

- Use `.glb` format - single file, browser-optimised, carries geometry, materials, and textures together
- Zone polygon complexity affects floor pool rendering - simpler polygons with fewer vertices render faster
- Increase `light_radius` and reduce sample count for Linear/Cove lights covering large areas
- The GI bounce (`gi_brightness`) is disabled by default; enable only where the extra ambient fill is visible
