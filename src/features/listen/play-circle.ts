/**
 * The round play buttons: on hover only the circle grows (a background layer scaled behind the icon), the icon keeps
 * its size, as in Spotify. `listen` is the green one, `light` the white one in the player bar.
 */
export const playCircle = {
  listen:
    'relative isolate grid place-items-center rounded-full text-listen-foreground before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-listen before:shadow-lg before:shadow-black/30 before:transition-[scale,background-color] before:duration-200 hover:before:scale-[1.07] hover:before:bg-listen-hover disabled:opacity-50',
  light:
    'relative isolate grid place-items-center rounded-full text-background before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-foreground before:transition-[scale] before:duration-200 hover:before:scale-[1.08]',
}
