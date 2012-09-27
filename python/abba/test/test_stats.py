#!/usr/bin/env python

# Copyright (c) 2012 Thumbtack, Inc.

import unittest

import abba.stats

Z_05 = abba.stats.get_z_critical_value(0.05)

class LessPreciseTestCase(unittest.TestCase):
    def assertAlmostEqual(self, first, second):
        return unittest.TestCase.assertAlmostEqual(self, first, second, places=3)

class GlobalsTest(LessPreciseTestCase):
    def test_z_value(self):
        self.assertAlmostEqual(1.960, Z_05)

class ProportionTest(LessPreciseTestCase):
    def test_estimate(self):
        p_estimate = abba.stats.Proportion(20, 1000).p_estimate()
        self.assertAlmostEqual(0.02, p_estimate.value)
        self.assertAlmostEqual(0.004, p_estimate.error)

    def test_agresti_coull_estimate(self):
        p_estimate = abba.stats.Proportion(20, 1000).p_estimate(z_critical_value=Z_05)
        self.assertAlmostEqual(0.022, p_estimate.value)
        self.assertAlmostEqual(0.005, p_estimate.error)

    def test_confidence_interval_on_proportion(self):
        value_with_interval = abba.stats.confidence_interval_on_proportion(20, 1000, 0.95)
        self.assertAlmostEqual(0.02, value_with_interval.value)
        self.assertAlmostEqual(0.031, value_with_interval.upper_bound)
        self.assertAlmostEqual(0.013, value_with_interval.lower_bound)

class ProportionComparisonTest(LessPreciseTestCase):
    def setUp(self):
        self.comparison = abba.stats.ProportionComparison(
            abba.stats.Proportion(20, 1000),
            abba.stats.Proportion(60, 2000),
        )

    def test_difference(self):
        difference = self.comparison.difference_estimate(0)
        difference_ratio = self.comparison.difference_ratio(0)
        self.assertAlmostEqual(0.01, difference.value)
        self.assertAlmostEqual(0.006, difference.error)
        self.assertAlmostEqual(0.5, difference_ratio.value)
        self.assertAlmostEqual(0.292, difference_ratio.error)

    def test_z_test(self):
        self.assertAlmostEqual(0.055, self.comparison.z_test())

    def test_iterated_test(self):
        self.assertAlmostEqual(0.191, self.comparison.iterated_test(2, 1e-7))
        self.assertAlmostEqual(
            0.095,
            self.comparison.iterated_test(2, 1e-7, improvement_only=True)
        )

    def test_trivial_case(self):
        comparison = abba.stats.ProportionComparison(
            abba.stats.Proportion(10, 100),
            abba.stats.Proportion(20, 200),
        )
        self.assertAlmostEqual(1, comparison.iterated_test(2, 1e-7))
        self.assertAlmostEqual(0.664, comparison.iterated_test(2, 1e-7, improvement_only=True))

class ExperimentTest(LessPreciseTestCase):
    def test_experiment(self):
        experiment = abba.stats.Experiment(
            num_trials=3,
            baseline_num_successes=20,
            baseline_num_trials=1000,
        )
        results = experiment.get_results(50, 2000)
        self.assertEquals(50, results.num_successes)
        self.assertEquals(2000, results.num_trials)
        self.assertAlmostEqual(0.025, results.proportion.value)
        self.assertAlmostEqual(0.018, results.proportion.lower_bound)
        self.assertAlmostEqual(0.035, results.proportion.upper_bound)
        self.assertAlmostEqual(0.005, results.improvement.value)
        self.assertAlmostEqual(-0.011, results.improvement.lower_bound)
        self.assertAlmostEqual(0.018, results.improvement.upper_bound)
        self.assertAlmostEqual(0.25, results.relative_improvement.value)
        self.assertAlmostEqual(-0.463, results.relative_improvement.lower_bound)
        self.assertAlmostEqual(0.781, results.relative_improvement.upper_bound)
        self.assertAlmostEqual(0.691, results.two_tailed_p_value)
        self.assertAlmostEqual(0.362, results.improvement_one_tailed_p_value)

        results = experiment.get_results(70, 2000)
        self.assertAlmostEqual(0.054, results.two_tailed_p_value)
        self.assertAlmostEqual(0.025, results.improvement_one_tailed_p_value)

        results = experiment.get_results(20, 2000)
        self.assertAlmostEqual(0.062, results.two_tailed_p_value)
        self.assertAlmostEqual(0.997, results.improvement_one_tailed_p_value)

if __name__ == '__main__':
    unittest.main()
