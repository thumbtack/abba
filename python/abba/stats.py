# Copyright (c) 2012 Thumbtack, Inc.

import collections
import math

from scipy import stats

def get_z_critical_value(alpha, two_tailed=True):
    """
    Returns the z critical value for a particular alpha = 1 - confidence level.  By default returns
    a two-tailed z-value, meaning the actual tail probability is alpha / 2.
    """
    if two_tailed:
        alpha /= 2
    return stats.distributions.norm.ppf(1 - alpha)

# a value with confidence interval bounds (not necessarily centered around the point estimate)
ValueWithInterval = collections.namedtuple(
    'ValueWithInterval',
    ('value', 'lower_bound', 'upper_bound'),
)

class ValueWithError(object):
    """
    A value with standard error, from which a confidence interval can be derived.
    """
    def __init__(self, value, error):
        self.value = value
        self.error = error

    def confidence_interval_width(self, z_critical_value):
        """
        z_critical_value should be the value at which the right-tail probability for a standard
        normal distribution equals half the desired alpha = 1 - confidence level:

        P(Z > z_value) = 1 - alpha / 2

        where Z is an N(0, 1) random variable.  Use get_z_critical_value(), or see
        http://en.wikipedia.org/wiki/Standard_normal_table.
        """
        return z_critical_value * self.error

    def value_with_interval(self, z_critical_value, estimated_value=None):
        width = self.confidence_interval_width(z_critical_value)
        return ValueWithInterval(
            value=estimated_value if estimated_value is not None else self.value,
            lower_bound=self.value - width,
            upper_bound=self.value + width,
        )

class BinomialDistribution(object):
    def __init__(self, num_trials, probability):
        self.num_trials = num_trials
        self.probability = probability
        self.expectation = num_trials * probability
        self.standard_deviation = math.sqrt(self.expectation * (1 - probability))
        self._binomial = stats.binom(num_trials, probability)

    def mass(self, count):
        return self._binomial.pmf(count)

    def cdf(self, count):
        return self._binomial.cdf(count)

    def survival(self, count):
        return 1 - self.cdf(count)

    def inverse_cdf(self, probability):
        return self._binomial.ppf(probability)

    def inverse_survival(self, probability):
        return self._binomial.isf(probability)

class Proportion(object):
    def __init__(self, num_successes, num_trials):
        """
        Represents a binomial proportion with num_successes successful samples out of num_trials
        total.
        """
        self.num_successes = num_successes
        self.num_trials = num_trials

    def p_estimate(self, z_critical_value=0):
        """
        Generate an adjusted estimate and error using the "Agresti-Coull Interval", see
        http://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval#Agresti-Coull_Interval.

        The estimated value is an adjusted best estimate for the actual probability. For example, if
        0 successes were observed out of 10 samples, it's unlikely the actual probability is zero,
        so the adjusted estimate will be slightly above zero.

        A z_critical_value of zero yields the ordinary Wald interval.
        """
        adjusted_num_trials = float(self.num_trials + z_critical_value**2)
        interval_center = (self.num_successes + z_critical_value**2 / 2) / adjusted_num_trials
        standard_error = math.sqrt(interval_center * (1 - interval_center) / adjusted_num_trials)
        return ValueWithError(interval_center, standard_error)

    def mixed_estimate(self, z_critical_value):
        """
        Returns an ValueWithInterval with a MLE value and upper/lower bounds from the Agresti-Coull
        interval.
        """
        return (
            self.p_estimate(z_critical_value=z_critical_value)
            .value_with_interval(z_critical_value, estimated_value=self.p_estimate().value)
        )

def confidence_interval_on_proportion(num_successes, num_trials, confidence_level=0.95):
    '''Convenience function with more straightforward interface.'''
    return Proportion(num_successes, num_trials).mixed_estimate(
        get_z_critical_value(1 - confidence_level)
    )

class ProportionComparison(object):
    def __init__(self, baseline, variation):
        self.baseline = baseline
        self.variation = variation

    def difference_estimate(self, z_critical_value):
        """
        Generate an estimate of the difference in success rates between the variation and the
        baseline.
        """
        baseline_p = self.baseline.p_estimate(z_critical_value=z_critical_value)
        variation_p = self.variation.p_estimate(z_critical_value=z_critical_value)
        difference = variation_p.value - baseline_p.value
        standard_error = math.sqrt(baseline_p.error ** 2 + variation_p.error ** 2)
        return ValueWithError(difference, standard_error)

    def difference_ratio(self, z_critical_value):
        """
        Return the difference in sucess rates as a proportion of the baseline success rate.
        """
        baseline_value = self.baseline.p_estimate(z_critical_value=z_critical_value).value
        difference = self.difference_estimate(z_critical_value=z_critical_value)
        ratio = difference.value / baseline_value
        error = difference.error / baseline_value
        return ValueWithError(ratio, error)

    def z_test(self, z_multiplier=1):
        """
        Perform a large-sample z-test of null hypothesis H0: p_baseline == p_variation against
        alternative hypothesis H1: p_baseline < p_variation.  Return the (one-tailed) p-value.

        z_multiplier: test z-value will be multiplied by this factor before computing a p-value.

        See http://en.wikipedia.org/wiki/Statistical_hypothesis_testing#Common_test_statistics,
        "Two-proportion z-test, pooled for d0 = 0".
        """
        pooled_stats = Proportion(
            self.baseline.num_successes + self.variation.num_successes,
            self.baseline.num_trials + self.variation.num_trials,
        )
        pooled_p_value = pooled_stats.p_estimate().value
        pooled_variance_of_difference = (
            pooled_p_value * (1 - pooled_p_value)
            * (1.0 / self.baseline.num_trials + 1.0 / self.variation.num_trials)
        )
        pooled_standard_error_of_difference = math.sqrt(pooled_variance_of_difference)
        test_z_value = self.difference_estimate(0).value / pooled_standard_error_of_difference
        adjusted_p_value = stats.distributions.norm.sf(test_z_value * z_multiplier)
        return adjusted_p_value

    def _binomial_coverage_interval(self, distribution, coverage_alpha):
        """
        For the given binomial distribution, compute an interval that covers at least (1 -
        coverage_alpha) of the total probability mass, centered at the expectation (unless we're at
        the boundary). Uses the normal approximation.
        """
        if distribution.num_trials < 1000:
            # don't even bother trying to optimize for small-ish sample sizes
            return (0, distribution.num_trials)
        else:
            return (
                int(math.floor(distribution.inverse_cdf(coverage_alpha / 2))),
                int(math.ceil(distribution.inverse_survival(coverage_alpha / 2))),
            )

    def _probability_union(self, probability, num_tests):
        """
        Given the probability of an event, compute the probability that it happens at least once in
        num_tests independent tests. This is used to adjust a p-value for multiple comparisons.
        When used to adjust alpha instead, this is called a Sidak correction (the logic is the same,
        the formula is inverted):
        http://en.wikipedia.org/wiki/Bonferroni_correction#.C5.A0id.C3.A1k_correction
        """
        return 1 - (1 - probability)**num_tests

    def iterated_test(self, num_tests, coverage_alpha, improvement_only=False):
        """
        Compute a p-value testing null hypothesis H0: p_baseline == p_variation against alternative
        hypothesis H1: p_baseline != p_variation by summing p-values conditioned on individual
        baseline success counts. This provides a more accurate correction for multiple testing but
        scales like O(sqrt(self.baseline.num_trials)), so can eventually get slow for very large
        values.

        Lower coverage_alpha increases accuracy at the cost of longer runtime. Roughly, the result
        will be accurate within no more than coverage_alpha (but this ignores error due to the
        normal approximation so isn't guaranteed).

        If improvement_only=True, computes p-value for alternative hypothesis
        H1: p_baseline < p_variation instead.
        """
        observed_delta = self.variation.p_estimate().value - self.baseline.p_estimate().value
        if observed_delta == 0 and not improvement_only:
            # a trivial case that the code below does not handle well
            return 1

        pooled_proportion = (
            (self.baseline.num_successes + self.variation.num_successes)
            / float(self.baseline.num_trials + self.variation.num_trials)
        )
        variation_distribution = BinomialDistribution(self.variation.num_trials, pooled_proportion)
        baseline_distribution = BinomialDistribution(self.baseline.num_trials, pooled_proportion)

        baseline_limits = self._binomial_coverage_interval(baseline_distribution, coverage_alpha)
        p_value = 0
        for baseline_successes in xrange(baseline_limits[0], baseline_limits[1] + 1):
            baseline_proportion = 1.0 * baseline_successes / self.baseline.num_trials
            if improvement_only:
                lower_trial_count = -1
                upper_trial_count = math.ceil(
                    (baseline_proportion + observed_delta) * self.variation.num_trials
                )
            else:
                observed_absolute_delta = abs(observed_delta)
                lower_trial_count = math.floor(
                    (baseline_proportion - observed_absolute_delta) * self.variation.num_trials
                )
                upper_trial_count = math.ceil(
                    (baseline_proportion + observed_absolute_delta) * self.variation.num_trials
                )

            # p-value of variation success counts "at least as extreme" for this particular
            # baseline success count
            p_value_at_baseline = (
                variation_distribution.cdf(lower_trial_count)
                + variation_distribution.survival(upper_trial_count - 1)
            )

            # this is exact because we're conditioning on the baseline count, so the multiple
            # tests are independent.
            adjusted_p_value = self._probability_union(p_value_at_baseline, num_tests)

            baseline_probability = baseline_distribution.mass(baseline_successes)
            p_value += baseline_probability * adjusted_p_value

        # the remaining baseline values we didn't cover contribute less than coverage_alpha to the
        # sum, so adding that amount gives us a conservative upper bound.
        return p_value + coverage_alpha

Results = collections.namedtuple(
    'Results',
    (
        'num_successes',
        'num_trials',
        'proportion', # ValueWithInterval
        'improvement', # ValueWithInterval
        'relative_improvement', # ValueWithInterval
        'two_tailed_p_value', # two-tailed p-value for trial != baseline
        'improvement_one_tailed_p_value', # one-tailed p-value for trial > baseline
    ),
)

class Experiment(object):
    P_VALUE_PRECISION = 1e-5

    def __init__(self, num_trials, baseline_num_successes, baseline_num_trials,
                 confidence_level=0.95):
        """
        num_trials: number of trials to be compared to the baseline
        confidence_level: used for all confidence intervals generated
        """
        self.num_comparisons = max(1, num_trials)
        self._baseline = Proportion(baseline_num_successes, baseline_num_trials)
        alpha = (1 - confidence_level) / num_trials # Bonferroni correction
        self._z_critical_value = get_z_critical_value(alpha)

    def get_baseline_proportion(self):
        return self._baseline.mixed_estimate(self._z_critical_value)

    def get_results(self, num_successes, num_trials):
        trial = Proportion(num_successes, num_trials)
        comparison = ProportionComparison(self._baseline, trial)
        return Results(
            num_successes=num_successes,
            num_trials=num_trials,
            proportion=trial.mixed_estimate(self._z_critical_value),
            improvement=comparison.difference_estimate(self._z_critical_value)
                .value_with_interval(
                    self._z_critical_value,
                    estimated_value=comparison.difference_estimate(0).value,
                ),
            relative_improvement=comparison.difference_ratio(self._z_critical_value)
                .value_with_interval(
                    self._z_critical_value,
                    estimated_value=comparison.difference_ratio(0).value,
                ),
            two_tailed_p_value=comparison.iterated_test(
                self.num_comparisons,
                self.P_VALUE_PRECISION,
            ),
            improvement_one_tailed_p_value=comparison.iterated_test(
                self.num_comparisons,
                self.P_VALUE_PRECISION,
                improvement_only=True,
            ),
        )
