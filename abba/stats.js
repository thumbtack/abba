var Abba = {};

// Friendly wrapper over jStat's normal distribution functions.
Abba.NormalDistribution = function(mean, standardDeviation) {
    if (mean === undefined) {
        mean = 0;
    }
    if (standardDeviation === undefined) {
        standardDeviation = 1;
    }
    this.mean = mean;
    this.standardDeviation = standardDeviation;
};
Abba.NormalDistribution.prototype = {
    density: function(value) {
        return jStat.normal.pdf(value, this.mean, this.standardDeviation);
    },

    // Returns P(x < value) for x standard normal. value may be any number.
    cdf: function(value) {
        return jStat.normal.cdf(value, this.mean, this.standardDeviation);
    },

    // Returns P(x > value) for x standard normal. value may be any number.
    survival: function(value) {
        return 1 - this.cdf(value);
    },

    // Returns z such that P(x < z) = probability for x standard normal.
    // probability must be in (0, 1).
    inverseCdf: function(probability) {
        return jStat.normal.inv(probability, this.mean, this.standardDeviation);
    },

    // Returns z such that P(x > z) = probability for x standard normal.
    // probability must be in (0, 1).
    inverseSurvival: function(probability) {
        return this.mean - (this.inverseCdf(probability) - this.mean);
    },
};

/* Distribution functions for the binomial distribution. Relies entirely on the normal
   approximation.

   jStat's binomial functions do not seem be to reliable or as performant for large cases. This
   class could be improved by making it compute exact binomial functions for small cases and fall
   back to the normal approximation for large cases.
*/
Abba.BinomialDistribution = function(numSamples, probability) {
    this.numSamples = numSamples;
    this.probability = probability;
    this.expectation = numSamples * probability;
    this.standardDeviation = Math.sqrt(this.expectation * (1 - probability));

    // normal approximation to this binomial distribution
    this._normal = new Abba.NormalDistribution(this.expectation, this.standardDeviation);
    this._lowerTailProbability = this._normal.cdf(-0.5);
    this._upperTailProbability = this._normal.survival(numSamples + 0.5);
};
Abba.BinomialDistribution.prototype = {
    mass: function(count) {
        return this._normal.density(count);
    },

    _rescaleProbability: function(probability) {
        return probability / (1 - this._lowerTailProbability - this._upperTailProbability);
    },

    cdf: function(count) {
        if (count < 0) {
            return 0;
        } else if (count >= this.numSamples) {
            return 1;
        } else {
            return this._rescaleProbability(
                this._normal.cdf(count + 0.5) - this._lowerTailProbability);
        }
    },

    survival: function(count) {
        return 1 - this.cdf(count);
    },

    inverseCdf: function(probability) {
        return Math.max(0, Math.min(this.numSamples, this._normal.inverseCdf(probability)));
    },

    inverseSurvival: function(probability) {
        return Math.max(0, Math.min(this.numSamples, this._normal.inverseSurvival(probability)));
    },
};

Abba.ValueWithInterval = function(value, intervalWidth) {
    this.value = value;
    this.intervalWidth = intervalWidth;
}
Abba.ValueWithInterval.prototype = {
    range: function() {
        return {
            lowerBound: this.value - this.intervalWidth,
            upperBound: this.value + this.intervalWidth
        };
    },
};

// A value with standard error, from which a confidence interval can be derived.
Abba.ValueWithError = function(value, error) {
    this.value = value;
    this.error = error;
}
Abba.ValueWithError.prototype = {
    /* criticalZValue should be the value at which the right-tail probability for a standard
       normal distribution equals half the desired alpha = 1 - confidence level:

       P(Z > zValue) = 1 - alpha / 2

       where Z is an N(0, 1) random variable.  Use NormalDistribution.inverseSurvival(), or see
       http://en.wikipedia.org/wiki/Standard_normal_table.
    */
    confidenceIntervalWidth: function(criticalZValue) {
        return criticalZValue * this.error;
    },

    valueWithInterval: function(criticalZValue) {
        return new Abba.ValueWithInterval(this.value, this.confidenceIntervalWidth(criticalZValue));
    },
};

// Represents a binomial proportion with numSuccesses successful samples out of numSamples total.
Abba.Proportion = function(numSuccesses, numSamples) {
    this.numSuccesses = numSuccesses;
    this.numSamples = numSamples;
    this._binomial = new Abba.BinomialDistribution(numSamples, numSuccesses / numSamples);
}
Abba.Proportion.prototype = {
    // Compute an estimate of the underlying probability of success.
    pEstimate: function(zCriticalValue) {
        return this._adjustedWaldEstimate(zCriticalValue);
    },

    /* Generate an estimate for the underlying probability of success using the maximum likelihood
       estimator and the normal approximation error.  This is the so-called Wald interval:

       http://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval#Normal_approximation_interval
    */
    _waldEstimate: function() {
        return new Abba.ValueWithError(this._binomial.probability, this._binomial.standardError);
    },

    /* Compute the "adjusted Wald interval", which can be thought of as a Wald interval with
       (zCriticalValue^2 / 2) added to the number of successes and the number of failures. The
       estimated probability of success is the center of the interval. This provides much better
       coverage than the Wald interval (and many other intervals), though it has the unintuitive
       property that the estimated probabilty is not numSuccesses / numSamples. See (section 1.4.2
       and problem 1.24):

       Agresti, Alan. Categorical data analysis. New York, NY: John Wiley & Sons; 2002.
    */
    _adjustedWaldEstimate: function(zCriticalValue) {
        var squaredZCriticalValue = zCriticalValue * zCriticalValue;
        var adjustedNumSamples = this.numSamples + squaredZCriticalValue;
        var adjustedBinomial = new Abba.BinomialDistribution(
            adjustedNumSamples,
            (this.numSuccesses + squaredZCriticalValue / 2) / adjustedNumSamples);
        return new Abba.ValueWithError(
            adjustedBinomial.probability,
            adjustedBinomial.standardDeviation / adjustedBinomial.numSamples);
    },
};

Abba.ProportionComparison = function(baseline, trial, zCriticalValue) {
    this.baseline = baseline;
    this.trial = trial;
    this._zCriticalValue = zCriticalValue;
    this._standardNormal = new Abba.NormalDistribution();
}
Abba.ProportionComparison.prototype = {
    // Generate an estimate of the difference in success rates between the trial and the baseline.
    differenceEstimate: function() {
        var baselineP = this.baseline.pEstimate(this._zCriticalValue);
        var trialP = this.trial.pEstimate(this._zCriticalValue);
        var difference = trialP.value - baselineP.value;
        var standardError = Math.sqrt(Math.pow(baselineP.error, 2) + Math.pow(trialP.error, 2));
        return new Abba.ValueWithError(difference, standardError);
    },

    // Return the difference in sucess rates as a proportion of the baseline success rate.
    differenceRatio: function() {
        var baselineValue = this.baseline.pEstimate(this._zCriticalValue).value;
        var ratio = this.differenceEstimate().value / baselineValue;
        var error = this.differenceEstimate().error / baselineValue;
        return new Abba.ValueWithError(ratio, error);
    },

    /* Compute various values useful for comparing proportions with null hypothesis that they have
       the same probability of success
    */
    _computeTestValues: function() {
        var pooledProportion =
            (this.baseline.numSuccesses + this.trial.numSuccesses)
            / (this.baseline.numSamples + this.trial.numSamples);
        var expectedDifference =
            pooledProportion * (this.trial.numSamples - this.baseline.numSamples);
        var observedDifference = this.trial.numSuccesses - this.baseline.numSuccesses;
        return {
            pooledProportion: pooledProportion,
            expectedDifference: expectedDifference,
            varianceOfDifference:
                pooledProportion * (1 - pooledProportion)
                * (this.baseline.numSamples + this.trial.numSamples),
            observedAbsoluteDeviation: Math.abs(observedDifference - expectedDifference),
        };
    },

    /* For the given binomial distribution, compute an interval that covers at least
       (1 - coverageAlpha) of the total probability mass, centered at the expectation (unless we're
       at the boundary). Uses the normal approximation.
    */
    _binomialCoverageInterval: function(distribution, coverageAlpha) {
        if (distribution.numSamples < 1000) {
            // don't even bother trying to optimize for small-ish sample sizes
            return [0, distribution.numSamples];
        } else {
            return [
                Math.floor(distribution.inverseCdf(coverageAlpha / 2)),
                Math.ceil(distribution.inverseSurvival(coverageAlpha / 2)),
            ];
        }
    },

    /* Given the probability of an event, compute the probability that it happens at least once in
       numTimes independent trials. This is used to adjust a p-value for multiple comparisons.
       When used to adjust alpha instead, this is called a Sidak correction (the logic is the same,
       the formula is inverted):

       http://en.wikipedia.org/wiki/Bonferroni_correction#.C5.A0id.C3.A1k_correction
    */
    _probabilityUnion: function(probability, numTimes) {
        return 1 - Math.pow(1 - probability, numTimes);
    },

    /* Compute a p-value testing null hypothesis H0: pBaseline == pTrial against alternative
       hypothesis H1: pBaseline != pTrial by summing p-values conditioned on individual baseline
       success counts. This provides a more accurate correction for multiple testing but scales like
       O(sqrt(this.baseline.numSamples)), so can eventually get slow. In that case we fall back to
       zTest().

       Lower coverageAlpha increases accuracy at the cost of longer runtime. Roughly, the result
       will be accurate within no more than coverageAlpha (but this ignores error due to the normal
       approximation so isn't guaranteed).
    */
    iteratedTest: function(numTrials, coverageAlpha) {
        var values = this._computeTestValues();
        var trialDistribution = new Abba.BinomialDistribution(this.trial.numSamples,
                                                              values.pooledProportion);
        var baselineDistribution = new Abba.BinomialDistribution(this.baseline.numSamples,
                                                                 values.pooledProportion);

        // compute smallest and largest differences between success counts that are "at least as
        // extreme" as the observed difference (the observed difference is equal to one of these)
        var minExtremeDifference =
            Math.floor(values.expectedDifference - values.observedAbsoluteDeviation);
        var maxExtremeDifference =
            Math.ceil(values.expectedDifference + values.observedAbsoluteDeviation);

        var baselineLimits = this._binomialCoverageInterval(baselineDistribution, coverageAlpha);
        var pValue = 0;
        for (var baselineSuccesses = baselineLimits[0];
             baselineSuccesses <= baselineLimits[1];
             baselineSuccesses++) {
            // p-value of trial success counts "at least as extreme" for this particular baseline
            // success count
            var pValueAtBaseline =
                trialDistribution.cdf(baselineSuccesses + minExtremeDifference)
                + trialDistribution.survival(baselineSuccesses + maxExtremeDifference - 1);

            // this is exact because we're conditioning on the baseline count, so the multiple
            // trials are independent.
            var adjustedPValue = this._probabilityUnion(pValueAtBaseline, numTrials);

            var baselineProbability = baselineDistribution.mass(baselineSuccesses);
            pValue += baselineProbability * adjustedPValue;
        }

        // the remaining baseline values we didn't cover contribute less than coverageAlpha to the
        // sum, so adding that amount gives us a conservative upper bound.
        return pValue + coverageAlpha;
    },
};

// numTrials: number of trials to be compared to the baseline (i.e., not including the baseline)
Abba.Experiment = function(numTrials, baselineNumSuccesses, baselineNumSamples, baseAlpha) {
    normal = new Abba.NormalDistribution();
    this._baseline = new Abba.Proportion(baselineNumSuccesses, baselineNumSamples);

    this._numComparisons = Math.max(1, numTrials);
    // all z-values are two-tailed
    var baseZCriticalValue = normal.inverseSurvival(baseAlpha / 2);
    var alpha = baseAlpha / this._numComparisons // Bonferroni correction
    this._zCriticalValue = normal.inverseSurvival(alpha / 2);
    // z critical value for confidence interval on individual proportions. We compute intervals with
    // confidence level < alpha for individual trial proportions, so that they correspond neatly to
    // the confidence interval on the difference (which is computed at confidence level alpha). This
    // happens because some of the relative error disappears when we subtract the two proportions.
    this._trialIntervalZCriticalValue = this._zCriticalValue / Math.sqrt(2)
}
Abba.Experiment.prototype = {
    getBaselineProportion: function() {
        return this._baseline.pEstimate(this._trialIntervalZCriticalValue).valueWithInterval(
            this._trialIntervalZCriticalValue);
    },

    getResults: function(numSuccesses, numSamples) {
        var trial = new Abba.Proportion(numSuccesses, numSamples);
        var comparison = new Abba.ProportionComparison(
            this._baseline, trial, this._trialIntervalZCriticalValue);
        return {
            proportion: trial.pEstimate(this._trialIntervalZCriticalValue).valueWithInterval(
                this._trialIntervalZCriticalValue),
            relativeImprovement: comparison.differenceRatio().valueWithInterval(
                this._zCriticalValue),
            pValue: comparison.iteratedTest(this._numComparisons, 1e-5),
        };
    },
};
