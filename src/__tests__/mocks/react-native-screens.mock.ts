export const Screen = 'Screen';
export const ScreenStack = 'ScreenStack';
export const useNavigation = () => ({ navigate: jest.fn(), goBack: jest.fn() });

export default {
  Screen,
  ScreenStack,
  useNavigation,
};
