import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isJsonValue, parseJson } from '../utils/common'

// Mock console methods
vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('common utility functions tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isJsonValue function', () => {
    it('should return true for valid JSON objects', () => {
      expect(isJsonValue('{"name": "John", "age": 30}')).toBe(true)
      expect(isJsonValue('{"data": {"nested": true}}')).toBe(true)
      expect(isJsonValue('{"empty": {}}')).toBe(true)
    })

    it('should return true for valid JSON arrays', () => {
      expect(isJsonValue('[1, 2, 3]')).toBe(true)
      expect(isJsonValue('["a", "b", "c"]')).toBe(true)
      expect(isJsonValue('[{"id": 1}, {"id": 2}]')).toBe(true)
      expect(isJsonValue('[]')).toBe(true)
    })

    it('should return false for primitive JSON values', () => {
      expect(isJsonValue('"string"')).toBe(false)
      expect(isJsonValue('123')).toBe(false)
      expect(isJsonValue('true')).toBe(false)
      expect(isJsonValue('false')).toBe(false)
      expect(isJsonValue('null')).toBe(false)
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

    it('should return false for invalid JSON', () => {
      expect(isJsonValue('{"invalid": json}')).toBe(false)
      expect(isJsonValue('{name: "John"}')).toBe(false)
      expect(isJsonValue('[1, 2, 3')).toBe(false)
      expect(isJsonValue('{"unclosed": true')).toBe(false)
    })

    it('should return false for strings that don\'t start with { or [', () => {
      expect(isJsonValue('not json')).toBe(false)
      expect(isJsonValue('123abc')).toBe(false)
      expect(isJsonValue('true but not object')).toBe(false)
    })

    it('should handle complex nested JSON', () => {
      const complexJson = JSON.stringify({
        users: [
          { id: 1, profile: { name: 'John', settings: { theme: 'dark' } } },
          { id: 2, profile: { name: 'Jane', settings: { theme: 'light' } } }
        ],
        metadata: {
          total: 2,
          filters: { active: true }
        }
      })
      expect(isJsonValue(complexJson)).toBe(true)
    })

    it('should handle JSON with special characters', () => {
      expect(isJsonValue('{"unicode": "🎉", "special": "tab\\t"}')).toBe(true)
      expect(isJsonValue('{"escaped": "quote\\"inside"}')).toBe(true)
    })
  })

  describe('parseJson function', () => {
    it('should parse valid JSON objects', () => {
      const jsonString = '{"name": "John", "age": 30}'
      const expected = { name: 'John', age: 30 }
      
      expect(parseJson(jsonString)).toEqual(expected)
    })

    it('should parse valid JSON arrays', () => {
      const jsonString = '[1, 2, 3, "test"]'
      const expected = [1, 2, 3, 'test']
      
      expect(parseJson(jsonString)).toEqual(expected)
    })

    it('should parse nested JSON structures', () => {
      const jsonString = '{"data": {"items": [{"id": 1}, {"id": 2}]}}'
      const expected = { data: { items: [{ id: 1 }, { id: 2 }] } }
      
      expect(parseJson(jsonString)).toEqual(expected)
    })

    it('should return original value for non-string input', () => {
      expect(parseJson(123)).toBe(123)
      expect(parseJson(true)).toBe(true)
      expect(parseJson(null)).toBe(null)
      expect(parseJson(undefined)).toBe(undefined)
      
      const obj = { test: true }
      expect(parseJson(obj)).toBe(obj)
      
      const arr = [1, 2, 3]
      expect(parseJson(arr)).toBe(arr)
    })

    it('should return original string for invalid JSON', () => {
      const invalidJson = '{"invalid": json}'
      expect(parseJson(invalidJson)).toBe(invalidJson)
      
      const malformedJson = '[1, 2, 3'
      expect(parseJson(malformedJson)).toBe(malformedJson)
    })

    it('should handle empty strings', () => {
      expect(parseJson('')).toBe('')
      expect(parseJson('   ')).toBe('   ')
    })

    it('should parse primitive JSON values', () => {
      expect(parseJson('"string"')).toBe('string')
      expect(parseJson('123')).toBe(123)
      expect(parseJson('true')).toBe(true)
      expect(parseJson('false')).toBe(false)
      expect(parseJson('null')).toBe(null)
    })

    it('should handle JSON with escape sequences', () => {
      const jsonWithEscapes = '{"tab": "\\t", "newline": "\\n", "quote": "\\""}'
      const expected = { tab: '\t', newline: '\n', quote: '"' }
      
      expect(parseJson(jsonWithEscapes)).toEqual(expected)
    })

    it('should handle Unicode in JSON', () => {
      const unicodeJson = '{"emoji": "🎉", "chinese": "你好"}'
      const expected = { emoji: '🎉', chinese: '你好' }
      
      expect(parseJson(unicodeJson)).toEqual(expected)
    })
  })

  describe('integration scenarios', () => {
    it('should work together for validating and parsing database JSON fields', () => {
      const validJsonStrings = [
        '{"user_preferences": {"theme": "dark", "notifications": true}}',
        '[{"type": "login", "timestamp": 1234567890}]',
        '{"metadata": {"version": "1.0", "features": ["auth", "sync"]}}'
      ]

      const invalidJsonStrings = [
        'plain text',
        '"just a string"',
        '123',
        'true',
        '{"unclosed": true'
      ]

      validJsonStrings.forEach(jsonStr => {
        expect(isJsonValue(jsonStr)).toBe(true)
        const parsed = parseJson(jsonStr)
        expect(typeof parsed).toBe('object')
        expect(parsed).not.toBe(jsonStr) // Should be parsed, not original string
      })

      invalidJsonStrings.forEach(str => {
        if (isJsonValue(str)) {
          // If it's considered valid JSON, parsing should work
          expect(() => parseJson(str)).not.toThrow()
        } else {
          // If not valid JSON for objects/arrays, parseJson should return original
          const result = parseJson(str)
          // For malformed JSON, it should return original string
          if (str.includes('{') && !str.includes('}')) {
            expect(result).toBe(str)
          }
        }
      })
    })

    it('should handle real-world database scenarios', () => {
      // Simulate JSON data that might come from mobile app databases
      const mobileAppData = [
        '{"session_data": {"user_id": 123, "last_activity": "2023-12-01T10:00:00Z"}}',
        '{"app_settings": {"push_notifications": true, "sync_frequency": 300}}',
        '[{"event": "app_open", "timestamp": 1701419200}, {"event": "feature_used", "feature": "camera"}]'
      ]

      mobileAppData.forEach(data => {
        expect(isJsonValue(data)).toBe(true)
        const parsed = parseJson(data)
        expect(parsed).toBeTruthy()
        expect(typeof parsed).toBe('object')
        
        // Should be able to stringify back to JSON
        expect(() => JSON.stringify(parsed)).not.toThrow()
      })
    })

    it('should handle edge cases from database extraction', () => {
      const edgeCases = [
        '', // Empty string from database
        '   ', // Whitespace only
        'null', // String "null" vs actual null
        '{}', // Empty object
        '[]', // Empty array
        '{"data": null}', // Object with null value
        '{"array": []}' // Object with empty array
      ]

      edgeCases.forEach(testCase => {
        // Should not throw errors
        expect(() => isJsonValue(testCase)).not.toThrow()
        expect(() => parseJson(testCase)).not.toThrow()
        
        const parsed = parseJson(testCase)
        // Parsed result should be defined (even if empty string)
        expect(parsed).toBeDefined()
      })
    })
  })

  describe('error handling and performance', () => {
    it('should handle very large JSON strings efficiently', () => {
      // Create a large but valid JSON object
      const largeObject = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `item_${i}`,
          active: i % 2 === 0
        }))
      }
      const largeJsonString = JSON.stringify(largeObject)

      expect(isJsonValue(largeJsonString)).toBe(true)
      
      const parsed = parseJson(largeJsonString)
      expect(parsed).toEqual(largeObject)
    })

    it('should handle deeply nested JSON', () => {
      let deepObject: any = { value: 'end' }
      for (let i = 0; i < 50; i++) {
        deepObject = { level: i, nested: deepObject }
      }
      const deepJsonString = JSON.stringify(deepObject)

      expect(isJsonValue(deepJsonString)).toBe(true)
      expect(parseJson(deepJsonString)).toEqual(deepObject)
    })

    it('should handle malformed JSON gracefully', () => {
      const malformedCases = [
        '{"missing_quote: true}',
        '{duplicate: duplicate}',
        '[1, 2, 3,]', // Trailing comma
        '{"extra": "comma",}',
        '{missing: "quotes"}'
      ]

      malformedCases.forEach(malformed => {
        expect(() => isJsonValue(malformed)).not.toThrow()
        expect(() => parseJson(malformed)).not.toThrow()
        
        // Should return false for isJsonValue and original string for parseJson
        expect(isJsonValue(malformed)).toBe(false)
        expect(parseJson(malformed)).toBe(malformed)
      })
    })
  })
})
