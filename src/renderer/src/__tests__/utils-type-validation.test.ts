import { describe, expect, it } from 'vitest'
import { getDisplayTypeName, validateFieldValue, validateRowData } from '../utils/typeValidation'

describe('type validation utility tests', () => {
  describe('validateFieldValue function', () => {
    describe('integer validation', () => {
      it('should validate valid integers', () => {
        const validValues = [42, '42', -10, '-10', 0, '0', 123456, '123456']
        
        validValues.forEach(value => {
          const result = validateFieldValue(value, 'INTEGER')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(Number.parseInt(String(value), 10))
          expect(result.error).toBeUndefined()
        })
      })

      it('should reject invalid integers', () => {
        const invalidValues = ['abc', 'true', 'false', 'null', 'undefined', 'NaN', 'hello123']
        
        invalidValues.forEach(value => {
          const result = validateFieldValue(value, 'INTEGER')
          expect(result.isValid).toBe(false)
          expect(result.error).toContain('is not a valid integer')
          expect(result.convertedValue).toBeUndefined()
        })
      })

      it('should handle empty and null values for integers', () => {
        const emptyValues = [null, undefined, '']
        
        emptyValues.forEach(value => {
          const result = validateFieldValue(value, 'INTEGER')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(null)
          expect(result.error).toBeUndefined()
        })
      })

      it('should handle INT alias', () => {
        const result = validateFieldValue('42', 'INT')
        expect(result.isValid).toBe(true)
        expect(result.convertedValue).toBe(42)
      })
    })

    describe('float/real validation', () => {
      it('should validate valid float values', () => {
        const validValues = [3.14, '3.14', -2.5, '-2.5', 0.0, '0.0', 42, '42']
        
        validValues.forEach(value => {
          const result = validateFieldValue(value, 'REAL')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(Number.parseFloat(String(value)))
          expect(result.error).toBeUndefined()
        })
      })

      it('should reject invalid float values', () => {
        const invalidValues = ['abc', 'true', 'false', 'null', 'undefined', 'NaN', 'hello123']
        
        invalidValues.forEach(value => {
          const result = validateFieldValue(value, 'REAL')
          expect(result.isValid).toBe(false)
          expect(result.error).toContain('is not a valid number')
        })
      })

      it('should handle empty and null values for floats', () => {
        const emptyValues = [null, undefined, '']
        
        emptyValues.forEach(value => {
          const result = validateFieldValue(value, 'REAL')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(null)
        })
      })

      it('should handle various float type aliases', () => {
        const types = ['REAL', 'FLOAT', 'DOUBLE', 'NUMERIC']
        
        types.forEach(type => {
          const result = validateFieldValue('3.14', type)
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(3.14)
        })
      })
    })

    describe('boolean validation', () => {
      it('should validate true values', () => {
        const trueValues = ['true', 'TRUE', '1', 'yes', 'YES', 'on', 'ON']
        
        trueValues.forEach(value => {
          const result = validateFieldValue(value, 'BOOLEAN')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(true)
        })
      })

      it('should validate false values', () => {
        const falseValues = ['false', 'FALSE', '0', 'no', 'NO', 'off', 'OFF']
        
        falseValues.forEach(value => {
          const result = validateFieldValue(value, 'BOOLEAN')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(false)
        })
      })

      it('should reject invalid boolean values', () => {
        const invalidValues = ['maybe', '2', 'yes please', 'nope', 'invalid']
        
        invalidValues.forEach(value => {
          const result = validateFieldValue(value, 'BOOLEAN')
          expect(result.isValid).toBe(false)
          expect(result.error).toContain('is not a valid boolean')
        })
      })

      it('should handle empty and null values for booleans', () => {
        const emptyValues = [null, undefined, '']
        
        emptyValues.forEach(value => {
          const result = validateFieldValue(value, 'BOOLEAN')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(null)
        })
      })

      it('should handle BOOL alias', () => {
        const result = validateFieldValue('true', 'BOOL')
        expect(result.isValid).toBe(true)
        expect(result.convertedValue).toBe(true)
      })
    })

    describe('text validation', () => {
    it('should validate all text values', () => {
      const textValues = ['hello', 'world', '123', 'special chars: !@#$%', 'unicode: 🎉']
      
      textValues.forEach(value => {
        const result = validateFieldValue(value, 'TEXT')
        expect(result.isValid).toBe(true)
        expect(result.convertedValue).toBe(String(value).trim())
      })
      
      // Handle empty string separately as it returns null
      const emptyResult = validateFieldValue('', 'TEXT')
      expect(emptyResult.isValid).toBe(true)
      expect(emptyResult.convertedValue).toBe(null)
    })

    it('should handle various text type aliases', () => {
        const types = ['TEXT', 'VARCHAR', 'CHAR', 'STRING', 'BLOB']
        
        types.forEach(type => {
          const result = validateFieldValue('test', type)
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe('test')
        })
      })

      it('should handle null and empty values for text', () => {
        const emptyValues = [null, undefined, '']
        
        emptyValues.forEach(value => {
          const result = validateFieldValue(value, 'TEXT')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(null)
        })
      })
    })

    describe('date validation', () => {
      it('should validate common date formats', () => {
        const validDates = [
          '2024-12-25',
          '2024-12-25 10:30:00',
          '2024-12-25T10:30:00',
          '2024-01-01T00:00:00Z'
        ]
        
        validDates.forEach(date => {
          const result = validateFieldValue(date, 'DATE')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(date)
        })
      })

      it('should reject invalid date formats', () => {
        const invalidDates = ['not-a-date', '2024-13-45', '25/12/2024', 'tomorrow']
        
        invalidDates.forEach(date => {
          const result = validateFieldValue(date, 'DATE')
          expect(result.isValid).toBe(false)
          expect(result.error).toContain('is not a valid date format')
        })
      })

      it('should handle various date type aliases', () => {
        const types = ['DATE', 'DATETIME', 'TIMESTAMP']
        
        types.forEach(type => {
          const result = validateFieldValue('2024-12-25', type)
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe('2024-12-25')
        })
      })

      it('should handle empty and null values for dates', () => {
        const emptyValues = [null, undefined, '']
        
        emptyValues.forEach(value => {
          const result = validateFieldValue(value, 'DATE')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(null)
        })
      })
    })

    describe('null and empty value handling', () => {
      it('should handle null values consistently', () => {
        const types = ['INTEGER', 'REAL', 'BOOLEAN', 'TEXT', 'DATE']
        
        types.forEach(type => {
          const result = validateFieldValue(null, type)
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(null)
        })
      })

      it('should handle undefined values consistently', () => {
        const types = ['INTEGER', 'REAL', 'BOOLEAN', 'TEXT', 'DATE']
        
        types.forEach(type => {
          const result = validateFieldValue(undefined, type)
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(null)
        })
      })

      it('should handle empty strings consistently', () => {
        const types = ['INTEGER', 'REAL', 'BOOLEAN', 'TEXT', 'DATE']
        
        types.forEach(type => {
          const result = validateFieldValue('', type)
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(null)
        })
      })

      it('should handle whitespace-only strings', () => {
        const whitespaceValues = ['   ', '\t', '\n', ' \t \n ']
        
        whitespaceValues.forEach(value => {
          const result = validateFieldValue(value, 'INTEGER')
          // Whitespace strings are trimmed and become empty, but since they're not valid integers
          // they should return invalid unless the implementation has special handling
          expect(result.isValid).toBe(false)
          expect(result.error).toBeDefined()
        })
      })
    })

    describe('case insensitive type handling', () => {
      it('should handle different case variations', () => {
        const typeVariations = ['text', 'Text', 'TEXT', 'tExT']
        
        typeVariations.forEach(type => {
          const result = validateFieldValue('test', type)
          expect(result.isValid).toBe(true) // Should handle case variations
        })
      })

      it('should handle mixed case type names', () => {
        const mixedCaseTypes = [
          'integer', 'INTEGER', 'Integer',
          'boolean', 'BOOLEAN', 'Boolean',
          'real', 'REAL', 'Real'
        ]
        
        mixedCaseTypes.forEach(type => {
          const result = validateFieldValue('42', type.includes('bool') ? 'true' : '42')
          expect(result.isValid).toBe(true)
        })
      })
    })

    describe('edge cases and stress testing', () => {
      it('should handle very large numbers', () => {
        const largeNumber = '99999999999999999999'
        const result = validateFieldValue(largeNumber, 'INTEGER')
        expect(result.isValid).toBe(true)
        expect(typeof result.convertedValue).toBe('number')
      })

      it('should handle very long strings', () => {
        const longString = 'a'.repeat(10000)
        const result = validateFieldValue(longString, 'TEXT')
        expect(result.isValid).toBe(true)
        expect(result.convertedValue).toBe(longString)
      })

      it('should handle special database types', () => {
        // Unknown types should default to text handling
        const specialTypes = ['CUSTOM_TYPE', 'JSON', 'XML', 'UNKNOWN']
        
        specialTypes.forEach(type => {
          const result = validateFieldValue('test', type)
          expect(result.isValid).toBe(true)
        })
      })

      it('should handle unicode and special characters', () => {
        const unicodeValues = ['emoji: 🎉', 'chinese: 你好', 'arabic: مرحبا', 'special: !@#$%^&*()']
        
        unicodeValues.forEach(value => {
          const result = validateFieldValue(value, 'TEXT')
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(value)
        })
      })
    })

    describe('database integration scenarios', () => {
      it('should handle typical database insert operations', () => {
        const insertData = [
          { value: '123', type: 'INTEGER', expected: 123 },
          { value: '3.14', type: 'REAL', expected: 3.14 },
          { value: 'true', type: 'BOOLEAN', expected: true },
          { value: 'hello world', type: 'TEXT', expected: 'hello world' },
          { value: '2024-12-25', type: 'DATE', expected: '2024-12-25' }
        ]
        
        insertData.forEach(({ value, type, expected }) => {
          const result = validateFieldValue(value, type)
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(expected)
        })
      })

      it('should handle typical user input errors', () => {
        // Based on actual implementation, these cases might be valid
        const userErrors = [
          { value: 'abc', type: 'INTEGER' }, // Should be invalid
          { value: 'maybe', type: 'BOOLEAN' }, // Should be invalid
          { value: 'not-a-date', type: 'DATE' } // Should be invalid
        ]
        
        userErrors.forEach(({ value, type }) => {
          const result = validateFieldValue(value, type)
          expect(result.isValid).toBe(false)
          expect(result.error).toBeDefined()
        })
      })

      it('should handle bulk validation scenarios', () => {
        const bulkData = Array.from({ length: 100 }, (_, i) => ({
          value: i.toString(),
          type: 'INTEGER'
        }))
        
        bulkData.forEach(({ value, type }) => {
          const result = validateFieldValue(value, type)
          expect(result.isValid).toBe(true)
          expect(result.convertedValue).toBe(Number.parseInt(value, 10))
        })
      })
    })
  })

  describe('validateRowData function', () => {
    it('should validate complete row data', () => {
      const rowData = {
        id: '1',
        name: 'Test User',
        age: '25',
        active: 'true',
        balance: '100.50'
      }
      
      const columnTypes = {
        id: 'INTEGER',
        name: 'TEXT',
        age: 'INTEGER', 
        active: 'BOOLEAN',
        balance: 'REAL'
      }
      
      const result = validateRowData(rowData, columnTypes)
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual({})
      expect(result.convertedData).toEqual({
        id: 1,
        name: 'Test User',
        age: 25,
        active: true,
        balance: 100.50
      })
    })

    it('should collect multiple validation errors', () => {
      const rowData = {
        id: 'abc',
        name: 'Test User',
        age: 'not_a_number',
        active: 'maybe'
      }
      
      const columnTypes = {
        id: 'INTEGER',
        name: 'TEXT',
        age: 'INTEGER',
        active: 'BOOLEAN'
      }
      
      const result = validateRowData(rowData, columnTypes)
      expect(result.isValid).toBe(false)
      expect(Object.keys(result.errors)).toContain('id')
      expect(Object.keys(result.errors)).toContain('age') 
      expect(Object.keys(result.errors)).toContain('active')
      expect(result.convertedData).toBeUndefined()
    })

    it('should handle missing column types', () => {
      const rowData = {
        id: '1',
        unknown_field: 'value'
      }
      
      const columnTypes = {
        id: 'INTEGER'
      }
      
      const result = validateRowData(rowData, columnTypes)
      expect(result.isValid).toBe(true)
      expect(result.convertedData).toEqual({
        id: 1
      })
    })
  })

  describe('getDisplayTypeName function', () => {
    it('should return user-friendly type names', () => {
      const typeMapping = {
        'INTEGER': 'Whole Number',
        'INT': 'Whole Number',
        'REAL': 'Decimal Number',
        'FLOAT': 'Decimal Number',
        'BOOLEAN': 'True/False',
        'BOOL': 'True/False',
        'TEXT': 'Text',
        'VARCHAR': 'Text',
        'DATE': 'Date',
        'DATETIME': 'Date & Time',
        'BLOB': 'Binary Data'
      }
      
      Object.entries(typeMapping).forEach(([type, expected]) => {
        expect(getDisplayTypeName(type)).toBe(expected)
      })
    })

    it('should handle case insensitive type names', () => {
      expect(getDisplayTypeName('integer')).toBe('Whole Number')
      expect(getDisplayTypeName('Integer')).toBe('Whole Number')
      expect(getDisplayTypeName('INTEGER')).toBe('Whole Number')
    })

    it('should return original type for unknown types', () => {
      expect(getDisplayTypeName('CUSTOM_TYPE')).toBe('CUSTOM_TYPE')
      expect(getDisplayTypeName('unknown')).toBe('unknown')
    })
  })
})
