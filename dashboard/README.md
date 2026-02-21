# Star Track Dashboard

A local dashboard for visualizing GitHub stars and PyPI download statistics.

## Running Locally

From the project root directory:

```bash
python -m http.server 8080
```

Then open http://localhost:8080/dashboard/ in your browser.

## Features

- **Summary Cards** - Total stars, total downloads, top grower
- **GitHub Stars Table** - All repos with change stats and streak indicators
- **PyPI Downloads Table** - All packages with change stats
- **Trend Charts** - Interactive line charts for selected items
- **Report Generator** - Generate weekly/monthly text reports
- **Filters** - Customize which repos/packages to display

## Report Format

Generated reports match the manual format:

```
Open-source numbers update! February 2026

GitHub stars - measure hype (↑ > 2.5%, ↓ < 2.5%)

Repository           Stars   Change (Abs / %)  Streak
------------------------------------------------------------
supervision         36,038     (+282 / +0.8%)  ↗
notebooks            8,926     (+291 / +3.4%)  ↗↗
```

## Design

Built with Apple Human Interface Guidelines styling:
- SF Pro font family
- Frosted glass cards (backdrop-filter blur)
- Monochromatic palette with system blue accent
- Minimal, clean aesthetic
