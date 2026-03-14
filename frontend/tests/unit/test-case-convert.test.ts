import { describe, it, expect } from 'vitest';
import { snakeToCamel, camelToSnake } from '@/lib/utils/case-convert';

describe('snakeToCamel', () => {
  it('converts simple snake_case keys', () => {
    expect(snakeToCamel({ user_name: 'John' })).toEqual({ userName: 'John' });
  });

  it('converts nested objects', () => {
    const input = { user_info: { first_name: 'John', last_name: 'Doe' } };
    const expected = { userInfo: { firstName: 'John', lastName: 'Doe' } };
    expect(snakeToCamel(input)).toEqual(expected);
  });

  it('handles arrays of objects', () => {
    const input = [{ batch_id: '1' }, { batch_id: '2' }];
    const expected = [{ batchId: '1' }, { batchId: '2' }];
    expect(snakeToCamel(input)).toEqual(expected);
  });

  it('returns null for null input', () => {
    expect(snakeToCamel(null)).toBeNull();
  });

  it('returns undefined for undefined input', () => {
    expect(snakeToCamel(undefined)).toBeUndefined();
  });

  it('preserves Date objects', () => {
    const date = new Date('2026-01-01');
    expect(snakeToCamel(date)).toEqual(date);
  });

  it('handles empty object', () => {
    expect(snakeToCamel({})).toEqual({});
  });

  it('converts keys with numbers', () => {
    expect(snakeToCamel({ s3_bucket: 'test' })).toEqual({ s3Bucket: 'test' });
  });

  it('preserves primitive values in arrays', () => {
    expect(snakeToCamel([1, 'hello', true])).toEqual([1, 'hello', true]);
  });

  it('handles deeply nested structures', () => {
    const input = {
      level_1: {
        level_2: {
          level_3: { deep_value: 42 },
        },
      },
    };
    expect(snakeToCamel(input)).toEqual({
      level1: {
        level2: {
          level3: { deepValue: 42 },
        },
      },
    });
  });
});

describe('camelToSnake', () => {
  it('converts simple camelCase keys', () => {
    expect(camelToSnake({ userName: 'John' })).toEqual({ user_name: 'John' });
  });

  it('converts nested objects', () => {
    const input = { userInfo: { firstName: 'John' } };
    const expected = { user_info: { first_name: 'John' } };
    expect(camelToSnake(input)).toEqual(expected);
  });

  it('handles arrays of objects', () => {
    const input = [{ batchId: '1' }];
    const expected = [{ batch_id: '1' }];
    expect(camelToSnake(input)).toEqual(expected);
  });

  it('returns null for null input', () => {
    expect(camelToSnake(null)).toBeNull();
  });

  it('returns undefined for undefined input', () => {
    expect(camelToSnake(undefined)).toBeUndefined();
  });

  it('preserves Date objects', () => {
    const date = new Date('2026-01-01');
    expect(camelToSnake(date)).toEqual(date);
  });
});

describe('round-trip conversion', () => {
  it('snake → camel → snake preserves keys', () => {
    const original = { user_name: 'test', batch_ids: [1, 2], created_at: 'now' };
    const result = camelToSnake(snakeToCamel(original));
    expect(result).toEqual(original);
  });

  it('camel → snake → camel preserves keys', () => {
    const original = { userName: 'test', batchIds: [1, 2], createdAt: 'now' };
    const result = snakeToCamel(camelToSnake(original));
    expect(result).toEqual(original);
  });
});
