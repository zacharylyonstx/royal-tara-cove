# 3D Model Attribution

All GLB models in this directory were generated with **Meshy AI** (text-to-3D,
https://meshy.ai) specifically for this project, then optimized with
`@gltf-transform/cli` (textures resized to 512px + WebP). Generated assets are
owned by the project per Meshy's terms; no third-party model attribution is
required.

Generation is reproducible via `scripts/meshy-batch.mjs` (needs `MESHY_API_KEY`).
Each `*.meta.json` records the prompt + Meshy task IDs used.

| Model | Used for |
|-------|----------|
| oak, crepemyrtle, shrub | Neighborhood trees + hero foundation shrubs |
| truck, sedan, bike | Drivable/parked vehicles (white body tinted per-house) |
| mailbox | Curbside mailboxes (hero keeps the LYONS name plate) |
| sofa, coffeetable, tv, floorlamp, houseplant | Neighbor living-room set |
| grill, patioset, trashbins | Yard props |
| fridge, stove, bookshelf | Hero house 10600 interior augments |
| gnome, milk, bonuscookie | Treehouse / Munchies pickups |
| ufo | Alien Invasion crash set-piece |
