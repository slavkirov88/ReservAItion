import { parseChildrenAges } from './children-ages'

test('pulls numbers out of what the agent heard', () => {
  expect(parseChildrenAges('5 и 8 години')).toEqual([5, 8])
  expect(parseChildrenAges('на 3')).toEqual([3])
})

test('empty input gives an empty list, not a zero', () => {
  expect(parseChildrenAges(null)).toEqual([])
  expect(parseChildrenAges('')).toEqual([])
  expect(parseChildrenAges('   ')).toEqual([])
})

test('ignores numbers that cannot be a child age', () => {
  expect(parseChildrenAges('2026 година, детето е на 4')).toEqual([4])
})

// A baby is a real answer and zero is a real age. A filter written as
// `n > 0` would drop it and Clock would price the stay as adults only.
test('keeps a baby under one year', () => {
  expect(parseChildrenAges('едното е на 0, другото на 6')).toEqual([0, 6])
})

test('handles digits written together with words', () => {
  expect(parseChildrenAges('деца: 7г. и 12г.')).toEqual([7, 12])
})
