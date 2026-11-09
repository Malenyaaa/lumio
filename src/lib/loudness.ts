/**
 * The ear hears loudness logarithmically, a media element's volume is linear: with a slider straight on it, the first
 * few percent did almost everything. Cubed (as system mixers do), every step of the slider sounds about as big.
 */
export const loudness = (level: number) => Math.min(1, Math.max(0, level)) ** 3

/** The slider position for an element's volume. */
export const levelOf = (volume: number) => Math.cbrt(Math.min(1, Math.max(0, volume)))
