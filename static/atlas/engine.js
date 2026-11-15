/* Terra-X terrain comparisons. Elevation units: metres; dx, dy: horizontal metres. */
(function (root) {
  "use strict";
  const FULL = [0, 0, 1, 1];
  const profiles = { navigation: 15, installation: 5 };
  const method = "Similarité = somme pondérée de deux proximités. Pente : écart de pente médiane ramené à 15°. Relief : écart de relief P90−P10 divisé par le plus grand relief des deux zones, avec un plancher de 50 m. Chaque proximité est bornée entre 0 et 100.";
  const limitations = [
    "Les seuils de pente et les poids sont des hypothèses de démonstration. L’aptitude décrit uniquement la fraction de terrain sous le seuil retenu.",
    "La confiance est un indice de couverture et de comparabilité du pas des grilles. Elle ne quantifie pas l’incertitude instrumentale.",
    "La pente est estimée à l’échelle du pas d’échantillonnage. Rochers, portance, météo, éclairement, gravité et radiation ne sont pas modélisés.",
    "Le rectangle délimite la cible. Chaque candidat terrestre est évalué sur son emprise entière. Des emprises différentes peuvent modifier le relief interquantile.",
    "Les altitudes utilisent les références verticales de chaque corps ; la comparaison porte sur les variations locales. Un même pas de grille ne garantit pas une résolution native identique."
  ];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function quantile(sorted, fraction) {
    if (!sorted.length) return null;
    const index = (sorted.length - 1) * fraction;
    const lower = Math.floor(index);
    return sorted[lower] + (index - lower) * (sorted[Math.ceil(index)] - sorted[lower]);
  }
  function indices(grid, box) {
    if (!grid || !Number.isInteger(grid.width) || !Number.isInteger(grid.height) ||
        grid.width < 1 || grid.height < 1 || !grid.values || grid.values.length !== grid.width * grid.height ||
        !(grid.dx > 0 && grid.dy > 0) || !grid.bbox || grid.bbox.length !== 4) {
      throw new Error("Grille de relief invalide.");
    }
    if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite)) {
      throw new Error("La zone attend quatre coordonnées normalisées.");
    }
    const [l,t,r,b] = box.map(v => clamp(v, 0, 1));
    if (r <= l || b <= t) throw new Error("La zone sélectionnée est vide.");
    return [Math.floor(l * grid.width), Math.floor(t * grid.height),
            Math.ceil(r * grid.width), Math.ceil(b * grid.height)];
  }
  function stats(grid, box = FULL) {
    const [left, top, right, bottom] = indices(grid, box);
    const [west, south, east, north] = grid.bbox;
    const lon = x => west + (east - west) * x / grid.width;
    const lat = y => north - (north - south) * y / grid.height;
    const at = (x,y) => grid.values[y * grid.width + x];
    const elevations = [], slopes = [], profile = [];
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const z = at(x,y);
        if (y === Math.floor((top + bottom - 1) / 2)) {
          profile.push({distance:(x-left) * grid.dx, elevation:Number.isFinite(z) ? z : null});
        }
        if (!Number.isFinite(z)) continue;
        elevations.push(z);
        if (x === left || x === right-1 || y === top || y === bottom-1) continue;
        const neighbors = [at(x-1,y), at(x+1,y), at(x,y-1), at(x,y+1)];
        if (!neighbors.every(Number.isFinite)) continue;
        const dzdx = (neighbors[1] - neighbors[0]) / (2 * grid.dx);
        const dzdy = (neighbors[3] - neighbors[2]) / (2 * grid.dy);
        slopes.push(Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI);
      }
    }
    elevations.sort((a,b) => a-b);
    slopes.sort((a,b) => a-b);
    const valid=elevations.length, total=(right-left)*(bottom-top);
    const interior=Math.max(0,right-left-2)*Math.max(0,bottom-top-2);
    return {
      slope:quantile(slopes,0.5), relief:valid ? quantile(elevations,0.9)-quantile(elevations,0.1) : null,
      median:quantile(elevations,0.5), valid,total,coverage:100*valid/total,
      slopeCount:slopes.length,slopeCoverage:interior ? 100*slopes.length/interior : 0,
      gentleNavigation:slopes.length ? 100*slopes.filter(s=>s<=profiles.navigation).length/slopes.length : null,
      gentleInstallation:slopes.length ? 100*slopes.filter(s=>s<=profiles.installation).length/slopes.length : null,
      profile, bbox:[lon(left),lat(bottom),lon(right),lat(top)]
    };
  }
  function combine(row, w) {
    if ((w>0 && row.slopeScore===null) || (w<100 && row.reliefScore===null)) return null;
    return ((row.slopeScore ?? 0)*w + (row.reliefScore ?? 0)*(100-w))/100;
  }
  function rank(rows, w) {
    const ordered = rows.map(row=>({...row,similarity:combine(row,w)})).sort((a,b)=>
      (b.similarity ?? -1)-(a.similarity ?? -1) || String(a.id).localeCompare(String(b.id)));
    let previous = null, previousRank = null;
    return ordered.map((row,i)=>{
      if (row.similarity === null) return {...row,rank:null};
      if (previous===null || Math.abs(previous-row.similarity)>1e-9) previousRank=i+1;
      previous=row.similarity;
      return {...row,rank:previousRank};
    });
  }
  function analyze(target, candidates, box = FULL, profile = "navigation", weight = 60) {
    if (!Object.hasOwn(profiles,profile) || !Number.isFinite(weight) || weight<0 || weight>100) {
      throw new Error("Profil ou pondération invalide.");
    }
    const reference = stats(target,box);
    const rows=candidates.map(grid=>{
      const s=stats(grid);
      const slopeScore=(reference.slope!==null && s.slope!==null)
        ? 100*clamp(1-Math.abs(reference.slope-s.slope)/15,0,1) : null;
      const reliefScore=(reference.relief!==null && s.relief!==null)
        ? 100*(1-Math.abs(reference.relief-s.relief)/Math.max(50,reference.relief,s.relief)) : null;
      const stepRatio=Math.min(target.dx,grid.dx)/Math.max(target.dx,grid.dx) *
        Math.min(target.dy,grid.dy)/Math.max(target.dy,grid.dy);
      const coverage=Math.min(reference.coverage,s.coverage);
      const slopeCoverage=Math.min(reference.slopeCoverage,s.slopeCoverage);
      return {id:grid.id,name:grid.name,slopeScore,reliefScore,stats:s,
        aptitude:profile==="navigation"?s.gentleNavigation:s.gentleInstallation,
        confidence:Math.sqrt(stepRatio)*(coverage*(100-weight)+slopeCoverage*weight)/100};
    });
    const ranked=rank(rows,weight);
    const trials=[...new Set([clamp(weight-15,0,100),weight,clamp(weight+15,0,100)])];
    const ranks=trials.map(w=>rank(rows,w));
    const results=ranked.map(row=>({...row,stable:row.rank!==null &&
      ranks.every(r=>r.some(candidate=>candidate.id===row.id && candidate.rank===row.rank))}));
    const topWins=results[0]?.rank===1 ? ranks.filter(r=>r.some(s=>s.id===results[0].id && s.rank===1)).length : 0;
    return {target:reference,results,box:[...box],bbox:reference.bbox,profile,weight,
      threshold:profiles[profile],stability:{trials:trials.length,topWins,weights:trials},method,limitations:[...limitations]};
  }
  root.TXEngine=Object.freeze({analyze,stats});
})(globalThis);
