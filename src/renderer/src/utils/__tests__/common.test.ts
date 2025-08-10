import { describe, expect, it } from 'vitest'
import { isJsonValue, parseJson } from '../../shared/utils/common'

describe('common utilities', () => {
  describe('isJsonValue', () => {
    it('should return true for valid JSON objects', () => {
      expect(isJsonValue('{"name": "John", "age": 30}')).toBe(true)
      expect(isJsonValue('{"nested": {"value": true}}')).toBe(true)
      expect(isJsonValue('{}')).toBe(true)
    })

    it('should return true for valid JSON arrays', () => {
      expect(isJsonValue('[1, 2, 3]')).toBe(true)
      expect(isJsonValue('["a", "b", "c"]')).toBe(true)
      expect(isJsonValue('[{"name": "John"}, {"name": "Jane"}]')).toBe(true)
      expect(isJsonValue('[]')).toBe(true)
    })

    it('should return false for non-string values', () => {
      expect(isJsonValue(123)).toBe(false)
      expect(isJsonValue(true)).toBe(false)
      expect(isJsonValue(null)).toBe(false)
      expect(isJsonValue(undefined)).toBe(false)
      expect(isJsonValue({})).toBe(false)
      expect(isJsonValue([])).toBe(false)
    })

    it('should return false for empty or whitespace strings', () => {
      expect(isJsonValue('')).toBe(false)
      expect(isJsonValue('   ')).toBe(false)
      expect(isJsonValue('\t\n')).toBe(false)
    })

    it('should return false for strings not starting with { or [', () => {
      expect(isJsonValue('not json')).toBe(false)
      expect(isJsonValue('123')).toBe(false)
      expect(isJsonValue('"string"')).toBe(false)
      expect(isJsonValue('true')).toBe(false)
      expect(isJsonValue('null')).toBe(false)
    })

    it('should return false for invalid JSON strings', () => {
      expect(isJsonValue('{"invalid": json}')).toBe(false)
      expect(isJsonValue('[1, 2, 3')).toBe(false)
      expect(isJsonValue('{"missing": "quote}')).toBe(false)
      expect(isJsonValue('{invalid}')).toBe(false)
    })

    it('should return false for JSON primitive values', () => {
      expect(isJsonValue('"just a string"')).toBe(false)
      expect(isJsonValue('42')).toBe(false)
      expect(isJsonValue('true')).toBe(false)
      expect(isJsonValue('false')).toBe(false)
      expect(isJsonValue('null')).toBe(false)
    })

    it('should handle JSON with whitespace', () => {
      expect(isJsonValue('  {"name": "John"}  ')).toBe(true)
      expect(isJsonValue('\t[1, 2, 3]\n')).toBe(true)
    })

    it('should handle complex nested JSON', () => {
      const complexJson = JSON.stringify({
        user: {
          name: 'John Doe',
          contacts: [
            { type: 'email', value: 'john@example.com' },
            { type: 'phone', value: '+1234567890' },
          ],
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
      })
      expect(isJsonValue(complexJson)).toBe(true)
    })

    it('should handle arrays with mixed types', () => {
      expect(isJsonValue('[1, "string", true, null, {"key": "value"}]')).toBe(true)
    })

    it('should return false for malformed JSON with trailing commas', () => {
      expect(isJsonValue('{"name": "John",}')).toBe(false)
      expect(isJsonValue('[1, 2, 3,]')).toBe(false)
    })
  })

  describe('parseJson', () => {
    it('should parse valid JSON strings to objects', () => {
      const jsonString = '{"name": "John", "age": 30}'
      const result = parseJson(jsonString)
      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should parse valid JSON arrays', () => {
      const jsonString = '[1, 2, 3]'
      const result = parseJson(jsonString)
      expect(result).toEqual([1, 2, 3])
    })

    it('should return original value for non-string input', () => {
      expect(parseJson(123)).toBe(123)
      expect(parseJson(true)).toBe(true)
      expect(parseJson(null)).toBe(null)
      expect(parseJson(undefined)).toBe(undefined)
      
      const obj = { key: 'value' }
      expect(parseJson(obj)).toBe(obj)
      
      const arr = [1, 2, 3]
      expect(parseJson(arr)).toBe(arr)
    })

    it('should return original string for invalid JSON', () => {
      const invalidJson = '{"invalid": json}'
      expect(parseJson(invalidJson)).toBe(invalidJson)
      
      const incompleteJson = '[1, 2, 3'
      expect(parseJson(incompleteJson)).toBe(incompleteJson)
      
      const notJson = 'just a regular string'
      expect(parseJson(notJson)).toBe(notJson)
    })

    it('should handle edge cases', () => {
      expect(parseJson('')).toBe('')
      expect(parseJson('   ')).toBe('   ')
      expect(parseJson('null')).toBe(null)
      expect(parseJson('true')).toBe(true)
      expect(parseJson('false')).toBe(false)
      expect(parseJson('42')).toBe(42)
      expect(parseJson('"string"')).toBe('string')
    })

    it('should handle complex nested JSON', () => {
      const complexObject = {
        user: {
          name: 'John Doe',
          contacts: [
            { type: 'email', value: 'john@example.com' },
            { type: 'phone', value: '+1234567890' },
          ],
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
      }
      const jsonString = JSON.stringify(complexObject)
      const result = parseJson(jsonString)
      expect(result).toEqual(complexObject)
    })

    it('should handle unicode characters', () => {
      const unicodeJson = '{"message": "Hello 世界", "emoji": "🌍"}'
      const result = parseJson(unicodeJson)
      expect(result).toEqual({ message: 'Hello 世界', emoji: '🌍' })
    })

    it('should handle escaped characters', () => {
      const escapedJson = '{"quote": "He said \\"Hello\\"", "path": "C:\\\\folder\\\\file.txt"}'
      const result = parseJson(escapedJson)
      expect(result).toEqual({ 
        quote: 'He said "Hello"', 
        path: 'C:\\folder\\file.txt', 
      })
    })
  })
})
