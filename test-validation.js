import { validateFieldValue } from './src/renderer/src/utils/typeValidation.js'

console.log('Testing whitespace:')
console.log('"   " ->', JSON.stringify(validateFieldValue('   ', 'INTEGER')))
console.log('""  ->', JSON.stringify(validateFieldValue('', 'INTEGER')))
console.log('"abc" ->', JSON.stringify(validateFieldValue('abc', 'INTEGER')))
