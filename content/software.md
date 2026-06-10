---
title: 'Software'
date: 2026-06-10
type: landing

design:
  # Section spacing
  spacing: '5rem'

# Page sections
sections:
  - block: markdown
    content:
      title: 'Software'
      text: |-
        Open-source tools I build and maintain. Below you can read the
        documentation, browse the source, or use the app directly in your
        browser.
    design:
      columns: '1'

  - block: markdown
    content:
      title: 'radiatR'
      text: |-
        **Analysis and visualisation of circular-arena tracking data.** An R
        package providing a complete pipeline for analysing animal orientation
        and movement in circular arenas — reading data from 20+ tracking tools
        (EthoVision, DeepLabCut, SLEAP, TRex, ANY-maze, TrackMate, idtracker.ai,
        and others), deriving per-trial heading directions, and producing
        circular-statistics summaries and figures.

        [📖 Documentation](https://johnkirwan.github.io/radiatR) ·
        [💻 Source on GitHub](https://github.com/JohnKirwan/radiatR) ·
        [🚀 Open the app in a new tab](https://johnkirwan.github.io/radiatR/app/)

        The interactive app below runs entirely in your browser (no install
        required) and may take a few seconds to start.
    design:
      columns: '1'

  - block: markdown
    content:
      text: |-
        {{< shinyapp src="https://johnkirwan.github.io/radiatR/app/" height="850px" title="radiatR Shiny app" >}}
    design:
      columns: '1'
---
