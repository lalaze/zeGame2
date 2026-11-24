// Which café the page draws. The cross-section building (assets/generated/art-direction-v1) is the
// game since 2026-11-24; the pixel room it replaced still opens with `?pixel`.
export const isFloorsView = (search: string = location.search): boolean => !new URLSearchParams(search).has('pixel');
