import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    'example_app/**', // For a specific build directory
    'resources/**', // For a specific resources directory
  ],
  rules: {
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
  },
})
