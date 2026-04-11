const { buildFullName, normalizeNameParts, splitFullName } = require('../../utils/name');

describe('utils/name', () => {
  test('buildFullName collapses duplicated stored name segments', () => {
    expect(buildFullName({
      first_name: 'Malfoy',
      middle_name: 'Malfoy De Vera',
      last_name: 'Malfoy De Vera',
    })).toBe('Malfoy De Vera');

    expect(buildFullName({
      first_name: 'Christian',
      middle_name: 'Christian',
      last_name: 'Christian',
    })).toBe('Christian');
  });

  test('normalizeNameParts removes deterministic duplicates from split name fields', () => {
    expect(normalizeNameParts({
      first_name: 'Jade',
      middle_name: 'Jade Bartolazo',
      last_name: 'Jade Bartolazo',
    })).toEqual({
      first_name: 'Jade',
      middle_name: null,
      last_name: 'Bartolazo',
    });
  });

  test('splitFullName preserves validation signal for single-token names', () => {
    expect(splitFullName('Marites')).toEqual({
      first_name: 'Marites',
      middle_name: null,
      last_name: 'Marites',
    });
  });
});
