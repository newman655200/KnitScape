export function isCodeGuideMode(search) {
  const source = search ?? window.location.search;
  const params = new URLSearchParams(source);
  return params.get("codeGuide") === "1";
}
