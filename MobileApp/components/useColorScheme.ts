// Force light theme across the mobile app for a consistent premium look.
// We keep the hook signature compatible with `react-native`'s useColorScheme
// so all existing callers (`const scheme = useColorScheme() ?? 'light'`) keep
// working without changes.
export function useColorScheme(): 'light' {
  return 'light';
}

