/**
 * One photoreal plate per book, made with Higgsfield (public/plates/<BOOK>.real.webp).
 * The ".real" part is a version: change it whenever the images are replaced, so
 * browsers and the image optimizer don't keep showing the old ones.
 */
export function plateSrc(book: string) {
  return `/plates/${book}.real.webp`;
}
