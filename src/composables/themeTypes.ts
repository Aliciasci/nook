// Shared primitive theme types — split out so usePreferencesStore.ts (the
// data layer) and useTheme.ts (the DOM-application layer) can both use them
// without a circular import between the two.
export type ThemeId = 'lavender' | 'soft-pink' | 'gothic' | 'pixel' | 'garden' | 'custom'
export type PresetThemeId = Exclude<ThemeId, 'custom'>
export type ThemeMode = 'light' | 'dark' | 'auto'
export type VisualIntensity = 'minimal' | 'normal' | 'expressive'
export type CornerStyle = 'soft' | 'sharp'
