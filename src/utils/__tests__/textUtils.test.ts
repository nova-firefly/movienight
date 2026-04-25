import { columnNameToDisplayName } from '../textUtils';

describe('columnNameToDisplayName', () => {
  it('converts snake_case to Title Case', () => {
    expect(columnNameToDisplayName('some_column')).toBe('Some Column');
  });

  it('handles single word', () => {
    expect(columnNameToDisplayName('name')).toBe('Name');
  });

  it('handles multiple underscores', () => {
    expect(columnNameToDisplayName('a_b_c')).toBe('A B C');
  });

  it('handles empty string', () => {
    expect(columnNameToDisplayName('')).toBe('');
  });

  it('handles already capitalized words', () => {
    expect(columnNameToDisplayName('Display_Name')).toBe('Display Name');
  });
});
