/** Lightweight EN / FR translation dictionary for TERRA-X POC. */
export const TRANSLATIONS = {
  en: {
    subtitle: "Planetary Intelligence & Earth Analogs Discovery",
    demoBtn: "3-Min Demo",
    mod1Title: "Planetary Explorer",
    aoiLabel: "Target Region (AOI)",
    mod2Title: "Earth Discovery",
    modeGlobal: "Global",
    modeRegional: "Morocco / NA",
    modeTriad: "Triad",
    runDiscovery: "Run Candidate Discovery",
    mod3Title: "Geospatial Layers",
    mod7Title: "Mission Simulator",
    weightsLabel: "What-If Weights (Σ = 1.00)",
    resetBtn: "Reset",
    tabMaps: "2D Explorer & Discovery",
    tabMatrix: "Similarity & Decision",
    tab3D: "3D Terrain Digital Twin",
    tabReport: "Report Generator",
    earthMapTitle: "Earth Analog Discovery Map",
    clickMarkerHint: "Click site to inspect",
    rankedTitle: "Ranked Earth Candidate Analogs (Similarity ≠ Mission Aptitude ≠ Confidence)",
    matrixTitle: "Multicriteria Similarity Matrix (Sⱼ = Σ wᵢ × sᵢⱼ)",
    matrixSub: "Scores reflect only physically comparable criteria. Missing data reduces Confidence rather than inflating Similarity.",
    threePillarsTitle: "3-Score Decision Breakdown (Selected Candidate)",
    sensitivityTitle: "What-If Weight Perturbation (±15%)",
    provenanceTitle: "Dataset Catalog & Scientific Provenance",
    twinTitle: "3D Terrain Digital Twin — Relief & Roughness Comparison",
    twinSub: "Compares DEM elevation range, mean slope, and surface roughness—never pretends to replicate planetary gravity or atmosphere.",
    transectTitle: "Cross-Section Elevation Profile (m)",
    reportTitle: "Scientific Report Generator",
    reportSub: "Traceable deliverable including AOI context, provenance, normalized scores, limits, and peer-reviewed bibliography.",
    mod6Title: "Scientific AI Copilot",
    copilotPrinciple: "LLM explains; scientific engine measures.",
    llmToggle: "Optional: Gemini API synthesis"
  },
  fr: {
    subtitle: "Intelligence Planétaire & Découverte d’Analogues Terrestres",
    demoBtn: "Démo 3 min",
    mod1Title: "Explorateur Planétaire",
    aoiLabel: "Zone Cible (AOI)",
    mod2Title: "Découverte Terrestre",
    modeGlobal: "Mondial",
    modeRegional: "Maroc / AN",
    modeTriad: "Triade",
    runDiscovery: "Lancer la Découverte",
    mod3Title: "Couches Géospatiales",
    mod7Title: "Simulateur de Mission",
    weightsLabel: "Poids What-If (Σ = 1.00)",
    resetBtn: "Réinitialiser",
    tabMaps: "Carte 2D & Découverte",
    tabMatrix: "Similarité & Décision",
    tab3D: "Jumeau Numérique 3D",
    tabReport: "Générateur de Rapport",
    earthMapTitle: "Carte des Sites Analogues Candidats",
    clickMarkerHint: "Cliquer un site pour inspecter",
    rankedTitle: "Classement des Candidats (Similarité ≠ Aptitude Mission ≠ Confiance)",
    matrixTitle: "Matrice de Similarité Multicritère (Sⱼ = Σ wᵢ × sᵢⱼ)",
    matrixSub: "Seules les variables physiquement comparables sont notées. Les données absentes réduisent la Confiance.",
    threePillarsTitle: "Décomposition des 3 Scores (Site Sélectionné)",
    sensitivityTitle: "Test de Robustesse What-If (±15 %)",
    provenanceTitle: "Catalogue de Données & Provenance Scientifique",
    twinTitle: "Jumeau Numérique 3D — Comparaison du Relief & Rugosité",
    twinSub: "Compare le MNT, la pente moyenne et la rugosité—ne prétend jamais recréer la gravité ou l’atmosphère.",
    transectTitle: "Profil Altimétrique Transversal (m)",
    reportTitle: "Générateur de Rapport Scientifique",
    reportSub: "Livrable traçable : contexte AOI, provenance, scores normalisés, limites et bibliographie.",
    mod6Title: "Copilote IA Scientifique",
    copilotPrinciple: "Le LLM explique ; le moteur scientifique calcule.",
    llmToggle: "Optionnel : Synthèse Gemini API"
  }
};

export function applyLanguage(lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
}
