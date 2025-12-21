---
title: "Uncertainty Quantification for Deep Regression using Contextualised Normalizing Flows"
date: '2025-12-01'
publication_types: ["paper-conference"]
publication: "The Thirty-ninth Annual Conference on Neural Information Processing Systems"
authors:
- Adriel Sosa Marco
- John D. Kirwan
- Alexia Toumpa
- Simos Gerasimou
hugoblox:
  ids:
    doi: ""
links:
- type: paper
  url: https://openreview.net/forum?id=ZL7RuWd6QK
- type: pdf
  url: https://openreview.net/pdf?id=ZL7RuWd6QK
- type: slides
  url: https://neurips.cc/media/neurips-2025/Slides/117361.pdf
featured: true
draft: false
bibfile: cite.bib
summary: "Post hoc uncertainty quantification for deep regression using contextualized normalizing flows without retraining the base model."
abstract: >-
  Quantifying uncertainty in deep regression models is important both for understanding
  the confidence of the model and for safe decision-making in high-risk domains.
  Existing approaches that yield prediction intervals overlook distributional information,
  neglecting the effect of multimodal or asymmetric distributions on decision-making.
  Similarly, full or approximated Bayesian methods, while yielding the predictive
  posterior density, demand major modifications to the model architecture and retraining.
  We introduce MCNF, a novel post hoc uncertainty quantification method that produces
  both prediction intervals and the full conditioned predictive distribution. MCNF
  operates on top of the underlying trained predictive model; thus, no predictive
  model retraining is needed. We provide experimental evidence that the MCNF-based
  uncertainty estimate is well calibrated, is competitive with state-of-the-art uncertainty
  quantification methods, and provides richer information for downstream decision-making
  tasks.
---
