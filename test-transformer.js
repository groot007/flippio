// Simple test file to verify the transformer works
import { transformToCamelCase } from './src/renderer/src/utils/caseTransformer'

// Test data with snake_case keys
const testData = {
  device_type: 'android',
  bundle_id: 'com.example.app',
  package_name: 'TestApp',
  remote_path: '/data/app/test.db',
  items: [
    { item_name: 'test1', item_value: 'value1' },
    { item_name: 'test2', item_value: 'value2' },
  ],
}

// Transform to camelCase
const transformed = transformToCamelCase(testData)

console.log('Original:', JSON.stringify(testData, null, 2))
console.log('Transformed:', JSON.stringify(transformed, null, 2))

// Expected output should have:
// deviceType, bundleId, packageName, remotePath
// and items array with itemName, itemValue
