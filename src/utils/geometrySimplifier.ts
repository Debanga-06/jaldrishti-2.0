/**
 * Ramer-Douglas-Peucker (RDP) Geometry Simplifier for Map Visualization
 * Reduces coordinate count for long-distance polyline rendering while preserving exact shape.
 * ALWAYS preserves original complete geometry in application store for calculations.
 */

// Perpendicular distance from point P to line segment AB
function perpendicularDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;

  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const u = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const clampedU = Math.max(0, Math.min(1, u));

  const projX = ax + clampedU * dx;
  const projY = ay + clampedU * dy;

  return Math.hypot(px - projX, py - projY);
}

// Ramer-Douglas-Peucker algorithm implementation
export function simplifyRDP(points: [number, number][], epsilon: number): [number, number][] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const recursiveResults1 = simplifyRDP(points.slice(0, index + 1), epsilon);
    const recursiveResults2 = simplifyRDP(points.slice(index), epsilon);
    return recursiveResults1.slice(0, recursiveResults1.length - 1).concat(recursiveResults2);
  }

  return [points[0], points[end]];
}

/**
 * Simplifies geometry deterministically down to targetMaxPoints for map visualization only.
 * Target limit default is 2,500 coordinates per route.
 */
export function simplifyDisplayGeometry(
  coords: [number, number][],
  targetMaxPoints: number = 2500
): [number, number][] {
  if (!coords || coords.length <= targetMaxPoints) {
    return coords;
  }

  // Binary search for epsilon to achieve targetMaxPoints efficiently
  let minEps = 0.00001; // ~1 meter
  let maxEps = 0.05;    // ~5 km
  let bestSimplified = coords;

  for (let iter = 0; iter < 8; iter++) {
    const midEps = (minEps + maxEps) / 2;
    const simplified = simplifyRDP(coords, midEps);

    if (simplified.length > targetMaxPoints) {
      minEps = midEps;
    } else {
      bestSimplified = simplified;
      maxEps = midEps;
    }
  }

  return bestSimplified;
}
