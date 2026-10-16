// Lucide icons via the Iconify Tailwind plugin. Class names must stay as full
// literals here so Tailwind can find them; add new icons to this map.
const ICONS = {
  "book-open": "icon-[lucide--book-open]",
  "calendar": "icon-[lucide--calendar]",
  "check": "icon-[lucide--check]",
  "chevron-down": "icon-[lucide--chevron-down]",
  "chevron-left": "icon-[lucide--chevron-left]",
  "chevron-right": "icon-[lucide--chevron-right]",
  "circle-check": "icon-[lucide--circle-check]",
  "copy": "icon-[lucide--copy]",
  "flame": "icon-[lucide--flame]",
  "hand-heart": "icon-[lucide--hand-heart]",
  "house": "icon-[lucide--house]",
  "history": "icon-[lucide--history]",
  "info": "icon-[lucide--info]",
  "library": "icon-[lucide--library-big]",
  "minus": "icon-[lucide--minus]",
  "notebook-pen": "icon-[lucide--notebook-pen]",
  "pencil": "icon-[lucide--pencil]",
  "moon": "icon-[lucide--moon]",
  "plus": "icon-[lucide--plus]",
  "refresh": "icon-[lucide--refresh-cw]",
  "scroll-text": "icon-[lucide--scroll-text]",
  "search": "icon-[lucide--search]",
  "share": "icon-[lucide--share]",
  "sparkles": "icon-[lucide--sparkles]",
  "sun": "icon-[lucide--sun]",
  "target": "icon-[lucide--target]",
  "trash": "icon-[lucide--trash-2]",
  "type": "icon-[lucide--type]",
  "user": "icon-[lucide--circle-user-round]",
  "x": "icon-[lucide--x]",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return <span aria-hidden="true" className={`${ICONS[name]} inline-block shrink-0 ${className}`} />;
}
