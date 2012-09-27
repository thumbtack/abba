'''Tools for statistical analysis of A/B test results.

ABBA provides several statistical tools for analysis of binomial data, typically resulting from A/B
tests:

* Wald and Agresti-Coull confidence intervals on binomial proportions
* Confidence intervals on the difference and ratio of two binomial proportions
* Hypothesis tests for inequality of two binomial proportions
* Multiple test correction for control of familywise error rate

Some simple example usage::

    >>> import abba.stats
    >>> abba.stats.confidence_interval_on_proportion(
    ...     num_successes=50, num_trials=200, confidence_level=0.99)
    ValueWithInterval(value=0.25, lower_bound=0.17962262748069852, upper_bound=0.33643200973247306)

    >>> experiment = abba.stats.Experiment(
    ...     num_trials=5, baseline_num_successes=50, baseline_num_trials=200)
    >>> results = experiment.get_results(num_successes=70, num_trials=190)
    >>> results.relative_improvement
    ValueWithInterval(value=0.4736842105263157, lower_bound=-0.014130868125315277, upper_bound=0.90421878236700903)
    >>> results.two_tailed_p_value
    0.047886616311815511


ABBA requires SciPy for underlying statistical functions.

For more info, see the docstrings, unit tests, and the ABBA website (including an interactive
Javascript version) at http://www.thumbtack.com/labs/abba/.
'''

__version__ = '0.1.0'
