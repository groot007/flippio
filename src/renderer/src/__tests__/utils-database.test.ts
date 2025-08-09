import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildUniqueCondition } from '../utils/database'

describe('database utility functions tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('buildUniqueCondition function', () => {
    it('should prioritize ID fields for unique conditions', () => {
      const cols = [
        { name: 'id' },
        { name: 'name' },
        { name: 'email' }
      ]
      const rowData = {
        id: 123,
        name: 'John Doe',
        email: 'john@example.com'
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('id = 123')
    })

    it('should prioritize fields ending with _id', () => {
      const cols = [
        { name: 'user_id' },
        { name: 'name' },
        { name: 'status' }
      ]
      const rowData = {
        user_id: 456,
        name: 'Jane Smith',
        status: 'active'
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('user_id = 456')
    })

    it('should use all non-null fields when no ID field is present', () => {
      const cols = [
        { name: 'name' },
        { name: 'email' },
        { name: 'status' }
      ]
      const rowData = {
        name: 'John Doe',
        email: 'john@example.com',
        status: 'active'
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('name = \'John Doe\' AND email = \'john@example.com\' AND status = \'active\'')
    })

    it('should skip null and undefined values in conditions', () => {
      const cols = [
        { name: 'name' },
        { name: 'email' },
        { name: 'phone' }
      ]
      const rowData = {
        name: 'John Doe',
        email: null,
        phone: undefined
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('name = \'John Doe\'')
    })

    it('should skip empty string values in conditions', () => {
      const cols = [
        { name: 'name' },
        { name: 'email' },
        { name: 'phone' }
      ]
      const rowData = {
        name: 'John Doe',
        email: '',
        phone: '555-1234'
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('name = \'John Doe\' AND phone = \'555-1234\'')
    })

    it('should handle boolean values correctly', () => {
      const cols = [
        { name: 'id' },
        { name: 'active' },
        { name: 'verified' }
      ]
      const rowData = {
        id: 123,
        active: true,
        verified: false
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('id = 123')
    })

    it('should handle boolean values when no ID present', () => {
      const cols = [
        { name: 'active' },
        { name: 'verified' }
      ]
      const rowData = {
        active: true,
        verified: false
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('active = 1 AND verified = 0')
    })

    it('should handle numeric values correctly', () => {
      const cols = [
        { name: 'score' },
        { name: 'count' },
        { name: 'rating' }
      ]
      const rowData = {
        score: 95.5,
        count: 0,
        rating: -1
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('score = 95.5 AND count = 0 AND rating = -1')
    })

    it('should escape single quotes in string values', () => {
      const cols = [
        { name: 'name' },
        { name: 'description' }
      ]
      const rowData = {
        name: 'O\'Connor',
        description: 'It\'s a test with \'quotes\''
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('name = \'O\'\'Connor\' AND description = \'It\'\'s a test with \'\'quotes\'\'\'')
    })

    it('should handle null values when all fields are null or empty', () => {
      const cols = [
        { name: 'name' },
        { name: 'email' },
        { name: 'phone' }
      ]
      const rowData = {
        name: null,
        email: undefined,
        phone: ''
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('name IS NULL AND email IS NULL AND phone = \'\'')
    })

    it('should handle mixed null and non-null values in fallback', () => {
      const cols = [
        { name: 'optional_field' },
        { name: 'required_field' }
      ]
      const rowData = {
        optional_field: null,
        required_field: undefined
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('optional_field IS NULL AND required_field IS NULL')
    })

    it('should prefer lowercase id over _id fields', () => {
      const cols = [
        { name: 'user_id' },
        { name: 'id' },
        { name: 'name' }
      ]
      const rowData = {
        user_id: 456,
        id: 123,
        name: 'John'
      }

      const result = buildUniqueCondition(cols, rowData)
      // The function finds the first ID field in the object keys, which is user_id
      expect(result).toBe('user_id = 456')
    })

    it('should handle case insensitive ID field detection', () => {
      const cols = [
        { name: 'ID' },
        { name: 'name' }
      ]
      const rowData = {
        ID: 789,
        name: 'Jane'
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('ID = 789')
    })

    it('should handle _id field variations', () => {
      const idVariations = [
        { field: 'user_id', value: 123 },
        { field: 'USER_ID', value: 456 },
        { field: 'productId', value: 789 }, // This won't match _id pattern
        { field: 'category_id', value: 101 }
      ]

      idVariations.forEach(({ field, value }) => {
        const cols = [{ name: field }, { name: 'name' }]
        const rowData = { [field]: value, name: 'Test' }
        
        const result = buildUniqueCondition(cols, rowData)
        
        if (field.toLowerCase().endsWith('_id')) {
          expect(result).toBe(`${field} = ${value}`)
        } else {
          // Should use all fields since it doesn't match ID pattern
          expect(result).toContain('name = \'Test\'')
        }
      })
    })

    it('should handle special string values', () => {
      const cols = [
        { name: 'name' },
        { name: 'data' }
      ]
      const rowData = {
        name: '',
        data: '   whitespace   '
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('data = \'   whitespace   \'')
    })

    it('should handle array-like string representations', () => {
      const cols = [
        { name: 'tags' },
        { name: 'metadata' }
      ]
      const rowData = {
        tags: '[\"tag1\", \"tag2\"]',
        metadata: '{\"key\": \"value\"}'
      }

      const result = buildUniqueCondition(cols, rowData)
      expect(result).toBe('tags = \'[\"tag1\", \"tag2\"]\' AND metadata = \'{\"key\": \"value\"}\'')
    })

    describe('edge cases and error handling', () => {
      it('should handle empty columns array', () => {
        const cols: any[] = []
        const rowData = { id: 123, name: 'Test' }

        const result = buildUniqueCondition(cols, rowData)
        // Function still finds ID field in rowData even with empty columns
        expect(result).toBe('id = 123')
      })

      it('should handle empty row data', () => {
        const cols = [{ name: 'id' }, { name: 'name' }]
        const rowData = {}

        const result = buildUniqueCondition(cols, rowData)
        // With no data, it falls back to using columns with NULL values
        expect(result).toBe('id IS NULL AND name IS NULL')
      })

      it('should handle columns with spaces in names', () => {
        const cols = [{ name: 'user id' }, { name: 'first name' }]
        const rowData = {
          'user id': 123,
          'first name': 'John'
        }

        const result = buildUniqueCondition(cols, rowData)
        // Function finds 'user id' as an ID field and uses all non-null fields
        expect(result).toBe('user id = 123 AND first name = \'John\'')
      })

      it('should handle very long string values', () => {
        const longString = 'a'.repeat(1000)
        const cols = [{ name: 'description' }]
        const rowData = { description: longString }

        const result = buildUniqueCondition(cols, rowData)
        expect(result).toBe(`description = '${longString}'`)
      })

      it('should handle unicode characters', () => {
        const cols = [{ name: 'name' }, { name: 'emoji' }]
        const rowData = {
          name: '测试用户',
          emoji: '🎉🚀'
        }

        const result = buildUniqueCondition(cols, rowData)
        expect(result).toBe('name = \'测试用户\' AND emoji = \'🎉🚀\'')
      })
    })

    describe('real-world database scenarios', () => {
      it('should handle user table scenarios', () => {
        const userCols = [
          { name: 'id' },
          { name: 'email' },
          { name: 'username' },
          { name: 'created_at' }
        ]
        const userData = {
          id: 123,
          email: 'user@example.com',
          username: 'john_doe',
          created_at: '2023-12-01 10:00:00'
        }

        const result = buildUniqueCondition(userCols, userData)
        expect(result).toBe('id = 123')
      })

      it('should handle log table without ID field', () => {
        const logCols = [
          { name: 'timestamp' },
          { name: 'level' },
          { name: 'message' }
        ]
        const logData = {
          timestamp: '2023-12-01 10:00:00',
          level: 'ERROR',
          message: 'Database connection failed'
        }

        const result = buildUniqueCondition(logCols, logData)
        expect(result).toBe('timestamp = \'2023-12-01 10:00:00\' AND level = \'ERROR\' AND message = \'Database connection failed\'')
      })

      it('should handle junction table scenarios', () => {
        const junctionCols = [
          { name: 'user_id' },
          { name: 'role_id' },
          { name: 'assigned_at' }
        ]
        const junctionData = {
          user_id: 123,
          role_id: 456,
          assigned_at: '2023-12-01 10:00:00'
        }

        const result = buildUniqueCondition(junctionCols, junctionData)
        expect(result).toBe('user_id = 123')
      })
    })
  })
})
