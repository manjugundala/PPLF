# Brand assets

PPLF uses the same Texas flag theme as the [Power Platform Monitoring Framework (PPMF)](https://github.com/manjugundala/PPMF),
matched to the infintgroup.com palette.

| File | Use |
|---|---|
| `logging-icon.svg` | PPLF app icon, master (scalable) |
| `logging-icon-512.png`, `-256`, `-245`, `-128`, `-64`, `-32` | App icon sizes. Upload `logging-icon-256.png` in Power Apps Studio under **Settings → General → Icon** |
| `brand-icon.svg`, `brand-icon-*.png`, `favicon.ico` | Shared brand icon (same files as PPMF) |

The logging icon is a sibling of the PPMF monitoring icon: the same navy tile, Texas star and
red stripe, with log lines and a red error marker in place of the pulse line.

## Colors

| Role | Hex |
|---|---|
| Primary (Old Glory Blue) | `#002868` |
| Primary dark | `#00205B` |
| Accent (red) | `#BF0D3E` |
| Background | `#F5F7FA` |
| Text / secondary text | `#1D2124` / `#646464` |

In the Configuration App the palette is the `BrandTheme` record set in **App.OnStart**
(copied from PPMF `power-apps/theme/BrandTheme.OnStart.fx`). It is a global variable, not a named
formula, because PPMF found named-formula theme records render blank in the published player.
