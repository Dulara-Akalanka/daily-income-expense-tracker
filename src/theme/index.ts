import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const BRAND = '#4F46E5';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 4,
  colors: {
    ...MD3LightTheme.colors,
    primary: BRAND,
    background: '#F6F7FB',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#A5B4FC',
    background: '#0F1115',
  },
};
