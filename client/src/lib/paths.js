// المتجر العام على الجذر "/"، وتطبيق العيلة كله تحت "/family"
export const FAMILY_BASE = "/family";
export const fam = (p = "") => `${FAMILY_BASE}${p}`;
