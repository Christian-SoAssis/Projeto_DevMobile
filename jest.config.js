module.exports = {
  preset: 'jest-expo',
  // Mock do módulo nativo do react-native-gesture-handler (decisão 16 —
  // pinça do visualizador em gestos nativos): sem isso, o import do pacote
  // tenta tocar a ponte nativa no ambiente de teste.
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Máquinas lentas/frio fazem o primeiro teste de cada suíte demorar mais
  // que o default (5s) e falhar por timeout — limite folgado para RNTL.
  testTimeout: 15000,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/domain/ports/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
