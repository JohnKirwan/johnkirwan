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

        Both packages can be installed from my
        [R-universe repository](https://johnkirwan.r-universe.dev/), and the
        hosted Shiny apps live on
        [Posit Connect Cloud](https://connect.posit.cloud/johnkirwan).
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
        [🚀 Open the app in a new tab](https://johnkirwan.github.io/radiatR/app/) ·
        [☁️ Hosted on Posit Connect Cloud](https://019f950c-e3cd-3ba0-a8cb-2a8a76a14dd5.share.connect.posit.cloud/)

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

  - block: markdown
    content:
      title: 'luxR'
      text: |-
        **Underwater light analysis and visual ecology.** An R package for
        quantifying and modelling underwater light environments: it propagates
        spectral irradiance through the water column via wavelength-resolved
        Beer–Lambert attenuation, converts between energy and photon-flux units,
        and estimates photoreceptor excitation and visual contrast. A bundled
        Jerlov table covers eight optical water types from 350–700 nm.

        [📖 Documentation](https://johnkirwan.github.io/luxR/) ·
        [💻 Source on GitHub](https://github.com/JohnKirwan/luxR) ·
        [🚀 Open the app in a new tab](https://johnkirwan.github.io/luxR/app/)

        The interactive app below also runs entirely in your browser and may
        take a few seconds to start.
    design:
      columns: '1'

  - block: markdown
    content:
      text: |-
        {{< shinyapp src="https://johnkirwan.github.io/luxR/app/" height="850px" title="luxR Shiny app" >}}
    design:
      columns: '1'
---
