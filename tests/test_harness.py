"""Ensure the oracle itself rejects broken results rather than only passing matches."""
import unittest
from test_reference import compare_case, exact_text, generate_cases, dataset_hash, verify
from fractions import Fraction


class ReferenceHarnessTests(unittest.TestCase):
    def setUp(self):
        self.case = {'id': 'example', 'expected': {'rational': {'n': '1', 'd': '3'}, 'dim': [1, 0, 0]}}
        self.actual = {'id': 'example', 'rational': {'n': '1', 'd': '3'}, 'dim': [1, 0, 0]}

    def test_wrong_value_is_rejected(self):
        self.actual['rational'] = {'n': '2', 'd': '3'}
        self.assertTrue(compare_case(self.case, self.actual))

    def test_wrong_dimensions_are_rejected(self):
        self.actual['dim'] = [0, 1, 0]
        self.assertTrue(compare_case(self.case, self.actual))

    def test_non_normalized_fraction_is_rejected(self):
        case = {'id': 'example', 'expected': {}}
        for q in ({'n': '2', 'd': '6'}, {'n': '-1', 'd': '-3'}, {'n': '1', 'd': '0'}):
            with self.subTest(q=q):
                self.assertTrue(compare_case(case, {**self.actual, 'rational': q}))

    def test_missing_and_reordered_results_are_rejected(self):
        with self.assertRaises(ValueError):
            verify([self.case], {'results': []})
        self.actual['id'] = 'other'
        self.assertTrue(compare_case(self.case, self.actual))

    def test_decimal_formatter_uses_exact_fraction(self):
        self.assertEqual(exact_text(Fraction(-3, 40)), '-0.075')
        self.assertEqual(exact_text(Fraction(1, 97)), '1/97')
        self.assertEqual(len(exact_text(Fraction(1, 5**100 * 2**5)).split('.')[1]), 100)

    def test_seed_reproduces_dataset(self):
        self.assertEqual(dataset_hash(generate_cases(123)), dataset_hash(generate_cases(123)))
        self.assertNotEqual(dataset_hash(generate_cases(123)), dataset_hash(generate_cases(124)))


if __name__ == '__main__':
    unittest.main()
