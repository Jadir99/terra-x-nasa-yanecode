/**
 * Verification Suite for static/js/hero-eyes-3d.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing static/js/hero-eyes-3d.js...');

const filePath = path.join(__dirname, '..', 'static', 'js', 'hero-eyes-3d.js');
assert(fs.existsSync(filePath), 'hero-eyes-3d.js must exist in static/js/');

const fileContent = fs.readFileSync(filePath, 'utf-8');

// 1. Verify telemetry strings match exact prompt specifications
assert(
  fileContent.includes('EARTH (TERRA) • Radius: 6,371 km • Semi-major: 1.000 AU • Analogs Mapped: 8 Sites'),
  'Earth telemetry string must match specification'
);
assert(
  fileContent.includes('MOON (LUNA) • Radius: 1,737 km • Orbital Period: 27.3 d • Target: Shackleton Rim'),
  'Moon telemetry string must match specification'
);
assert(
  fileContent.includes('MARS (ARES) • Radius: 3,389 km • Distance: 1.524 AU • Target: Jezero Crater'),
  'Mars telemetry string must match specification'
);

// 2. Verify color codes
assert(fileContent.includes('#078FE0') || fileContent.includes('#078fe0'), 'Atmospheric glow must match #078FE0');
assert(fileContent.includes('#E87532') || fileContent.includes('#e87532'), 'Mars color must match #E87532');

// 3. Verify orbital inclinations and camera lerp
assert(fileContent.includes('THREE.Vector3.lerp') || fileContent.includes('.lerp('), 'Must use Vector3 lerp for smooth camera glide');
assert(fileContent.includes('moonInclination'), 'Must calculate Moon orbital inclination');
assert(fileContent.includes('marsInclination'), 'Must calculate Mars orbital inclination');

// 4. Verify Accessibility & UI/UX Pro Max guidelines
assert(fileContent.includes('role') && fileContent.includes('img'), 'Must set role="img"');
assert(fileContent.includes('aria-label'), 'Must set aria-label');
assert(fileContent.includes('prefers-reduced-motion'), 'Must check prefers-reduced-motion');
assert(fileContent.includes('container.clientWidth') || fileContent.includes('this.container.clientWidth'), 'Must size using container dimensions, never hardcoded');
assert(fileContent.includes('ResizeObserver'), 'Must use ResizeObserver for container resizing');

// 5. Verify Fallback handling
assert(fileContent.includes('renderFallback') || fileContent.includes('fallback'), 'Must have graceful WebGL fallback');

// 6. Verify HTML integration
const htmlPath = path.join(__dirname, '..', 'static', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
assert(htmlContent.includes('id="heroEyesCanvas"'), 'index.html must contain #heroEyesCanvas');
assert(htmlContent.includes('hero-eyes-hud'), 'index.html must contain .hero-eyes-hud');
assert(htmlContent.includes('hero-eyes-3d.js'), 'index.html must link hero-eyes-3d.js');
assert(htmlContent.includes('three.min.js'), 'index.html must link three.min.js');

// 7. Verify CSS integration
const cssPath = path.join(__dirname, '..', 'static', 'spacex.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');
assert(cssContent.includes('.hero-eyes-container'), 'spacex.css must style .hero-eyes-container');
assert(cssContent.includes('.hero-eyes-hud'), 'spacex.css must style .hero-eyes-hud');
assert(cssContent.includes('.hero-eyes-vignette'), 'spacex.css must style .hero-eyes-vignette');
assert(cssContent.includes('.hero-eyes-reticle'), 'spacex.css must style .hero-eyes-reticle');

console.log('✔ All 7 test categories passed with 100% compliance!');
