import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

jest.mock('@/constants/theme', () => ({
  Colors: {
    dark: { text: 'dark-theme' },
    light: { text: 'light-theme' },
  },
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(),
}));

function ThemePreview() {
  const theme = useTheme();
  return <Text>{theme.text}</Text>;
}

describe('useTheme', () => {
  it('uses the selected color scheme', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    const { getByText } = await render(<ThemePreview />);

    expect(getByText('dark-theme')).toBeTruthy();
  });
});
