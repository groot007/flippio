import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    'example_app/**', // For a specific build directory
    'resources/**', // For a specific resources directory
    'docs/**', // For documentation directory
    '**/*.toml',
    '**/*.md',
  ],
  rules: {
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'eslint-comments/no-unlimited-disable': 'off',
    'no-console': 'off',
    // Disable strict JSON key ordering
    'jsonc/sort-keys': 'off',
    // Disable trailing spaces rule for JSON files
    'style/no-trailing-spaces': 'off',
  },
})
