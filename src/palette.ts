/**
 * Colors of the real product, sampled from photographs and evened out for
 * print (label) and material (glass, cap, doogh), plus the film's darks.
 * Keep the CSS tokens in style.css in sync.
 */
export const colors = {
  // Label
  labelField: '#2c8ed8',
  labelBorder: '#1d58a6',
  labelRule: '#f4f7f6',
  labelOval: '#f0bd2c',
  labelOvalLight: '#f6cd45',
  labelKeyline: '#1f4672',
  labelInk: '#1d3784',
  // Product
  cap: '#2b3173',
  doogh: '#f7f8f4',
  glassTint: '#d3e8da',
  // Film
  ink: '#06080b',
  night: '#0a1330',
  milk: '#f4f2ec',
  snowShade: '#a9c4e0',
} as const

/** The palette the previous world shader uses. */
export const palette = {
  blue: colors.labelField,
  blueDeep: colors.labelBorder,
  sky: '#5aa9e3',
  yellow: colors.labelOval,
  navy: colors.labelInk,
  night: colors.night,
  milk: colors.milk,
  doogh: colors.doogh,
  snowShade: colors.snowShade,
  ink: colors.ink,
} as const
