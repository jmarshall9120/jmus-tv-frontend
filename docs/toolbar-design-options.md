# Toolbar design options

Three directions for simplifying and improving the dashboard toolbar.

---

## Option A – Compact single bar (implemented)

- **One card** for all controls; week range on a second row inside the same card.
- **Chips** for “Group by” instead of five separate buttons; clearer “View” vs “Group by” vs “Dates” vs “KPIs”.
- **Switch** for “Include lift” instead of a button; less visual noise.
- **Tooltip** for “Rotation / Day part: clicking one turns the other off” instead of inline caption.
- **Softer styling**: flat/elevation-0 card, more spacing, muted labels.

**Pros:** Less clutter, single place for filters, familiar pattern.  
**Cons:** Chips still show five options; can feel tight on small screens.

---

## Option B – Collapsible “Filters” panel

- **Default:** Only “View” (Spot-level) + week range visible in a slim bar.
- **“Filters” or “More options”** button opens a drawer/expandable panel with Group by + KPIs.
- **Progressive disclosure:** Power users expand; others see a minimal bar.

**Pros:** Very clean default; reduces “too much” feeling.  
**Cons:** Group by and KPIs are one click away; some users may not discover them.

---

## Option C – Tabs + inline

- **Tabs:** “View & dates” | “Grouping” | “KPIs”.
- **Tab 1:** Spot-level toggle + week range (From / To).
- **Tab 2:** Group by options (Week, Station, DOW, Rotation, Day part) with short hint.
- **Tab 3:** Include lift switch + short explanation.

**Pros:** Clear separation of concerns; each tab is simple.  
**Cons:** Requires switching tabs to change view and grouping together.

---

## Recommendation

Option A is implemented so you can try it immediately. If the bar still feels heavy, Option B (collapsible filters) is the next step. Option C is best if you want to strictly separate “what I’m looking at” (view/dates) from “how it’s grouped” and “how KPIs are calculated.”
