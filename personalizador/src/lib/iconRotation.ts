export function rotationFromPointer(initialRotation: number, startAngle: number, currentAngle: number): number {
  let delta = currentAngle - startAngle;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  const rotation = initialRotation + delta;
  const normalized = ((rotation + 180) % 360 + 360) % 360 - 180;
  return Math.round(normalized * 10) / 10;
}
