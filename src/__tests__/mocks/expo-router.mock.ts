export const useRouter = () => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  path: '/',
  params: {},
  pathname: '/',
  query: {},
  asPath: '/',
});

export const useLocalSearchParams = () => ({});
export const useGlobalSearchParams = () => ({});
export const Link = ({ children, ...props }: any) => children;
export const Redirect = ({ href }: any) => null;
export const Stack = ({ children }: any) => children;
export const Tabs = ({ children }: any) => children;
export const usePathname = () => '/';
export const createStackNavigator = () => ({ Screen: () => null });
export const createTabsNavigator = () => ({ Screen: () => null });

export default {
  useRouter,
  useLocalSearchParams,
  useGlobalSearchParams,
  Link,
  Redirect,
  Stack,
  Tabs,
  usePathname,
  createStackNavigator,
  createTabsNavigator,
};
