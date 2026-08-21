let activeStroke = null;

export function claimYarnStroke(stroke) {
  if (activeStroke !== null) return false;
  activeStroke = stroke;
  return true;
}

export function releaseYarnStroke(stroke) {
  if (activeStroke !== stroke) return false;
  activeStroke = null;
  return true;
}
