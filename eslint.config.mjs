import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    'example_app/build/**', // For a specific build directory
    'example_app/android/**', // For a specific Expo build directory
    'example_app/ios/**', // For a specific Expo build directory
    'resources/**', // For a specific resources directory
  ],
  rules: {
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
  },
})
