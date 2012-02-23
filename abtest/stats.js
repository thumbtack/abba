var ABTest = {};

/* Polynomial and rational approximations to standard normal probability functions. From:

   Abramowitz, Milton; Stegun, Irene A., eds. (1972), Handbook of Mathematical Functions with
   Formulas, Graphs, and Mathematical Tables, New York: Dover Publications, ISBN 978-0-486-61272-0

   Available online at http://people.math.sfu.ca/~cbm/aands/
*/
ABTest.NormalDistribution = function() {}
ABTest.NormalDistribution.prototype = {
    density: function(zValue) {
        return 1 / Math.sqrt(2 * Math.PI) * Math.exp(-zValue * zValue / 2);
    },

    // Returns P(x < zValue) for x standard normal. zValue may be any number.
    cdf: function(zValue) {
        // Formula 26.2.17, http://people.math.sfu.ca/~cbm/aands/page932.htm
        // Valid for zValue >= 0, abs(error) < 7.5 x 10^-8
        var p = 0.2316419;
        var b1 = 0.319381530;
        var b2 = -0.356563782;
        var b3 = 1.781477937;
        var b4 = -1.821255978;
        var b5 = 1.330274429;

        var isInverted = false;
        if (zValue < 0) {
            zValue = -zValue;
            isInverted = true;
        }

        var t = 1 / (1 + p * zValue);
        var density = this.density(zValue);
        var probability = 1 - density * t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
        if (isInverted) {
            probability = 1 - probability;
        }
        return probability;
    },

    // Returns P(x > zValue) for x standard normal. zValue may be any number.
    survival: function(zValue) {
        return 1 - this.cdf(zValue);
    },

    // Returns z such that P(x > z) = probability for x standard normal.
    // probability must be in (0, 1).
    inverseSurvival: function(probability) {
        // Formula 26.2.23, http://people.math.sfu.ca/~cbm/aands/page933.htm
        // Valid for 0 < probability <= 0.5, abs(error) < 4.5 x 10^-4
        var c0 = 2.515517;
        var c1 = 0.802853;
        var c2 = 0.010328;
        var d1 = 1.432788;
        var d2 = 0.189269;
        var d3 = 0.001308;

        var multiplier = 1;
        if (probability > 0.5) {
            probability = 1 - probability;
            multiplier = -1;
        }

        var t = Math.sqrt(
            Math.log(1 / (probability * probability))
        );
        var zEstimate = t - (c0 + t * (c1 + t * c2)) / (1 + t * (d1 + t * (d2 + t * d3)));
        return zEstimate * multiplier;
    },

    // Returns z such that P(x < z) = probability for x standard normal.
    // probability must be in (0, 1).
    inverseCdf: function(probability) {
        return -this.inverseSurvival(probability);
    },
};

ABTest.ValueWithInterval = function(value, intervalWidth) {
    this.value = value;
    this.intervalWidth = intervalWidth;
}
ABTest.ValueWithInterval.prototype = {
    range: function() {
        return {
            lowerBound: this.value - this.intervalWidth,
            upperBound: this.value + this.intervalWidth
        };
    },
};

// A value with standard error, from which a confidence interval can be derived.
ABTest.ValueWithError = function(value, error) {
    this.value = value;
    this.error = error;
}
ABTest.ValueWithError.prototype = {
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
        return new ABTest.ValueWithInterval(this.value,
                                            this.confidenceIntervalWidth(criticalZValue));
    },
};

// Represents a binomial proportion with numSuccesses successful samples out of numSamples total.
ABTest.Proportion = function(numSuccesses, numSamples) {
    this.numSuccesses = numSuccesses;
    this.numSamples = numSamples;
}
ABTest.Proportion.prototype = {
    /* Generate an estimate for the underlying probability of success using the maximum likelihood
       estimator and the normal approximation error.
    */
    pEstimate: function() {
        var pEstimate = 1.0 * this.numSuccesses / this.numSamples;
        var standardError = Math.sqrt(pEstimate * (1 - pEstimate) / this.numSamples);
        return new ABTest.ValueWithError(pEstimate, standardError);
    },
};

ABTest.ProportionComparison = function(baseline, trial) {
    this.baseline = baseline;
    this.trial = trial;
    this._normal = new ABTest.NormalDistribution();
}
ABTest.ProportionComparison.prototype = {
    // Generate an estimate of the difference in success rates between the trial and the baseline.
    differenceEstimate: function() {
        var baselineP = this.baseline.pEstimate();
        var trialP = this.trial.pEstimate();
        var difference = trialP.value - baselineP.value;
        var standardError = Math.sqrt(Math.pow(baselineP.error, 2) + Math.pow(trialP.error, 2));
        return new ABTest.ValueWithError(difference, standardError);
    },

    // Return the difference in sucess rates as a proportion of the baseline success rate.
    differenceRatio: function() {
        var baselineValue = this.baseline.pEstimate().value;
        var ratio = this.differenceEstimate().value / baselineValue;
        var error = this.differenceEstimate().error / baselineValue;
        return new ABTest.ValueWithError(ratio, error);
    },

    /* Perform a large-sample z-test of null hypothesis H0: pBaseline == pTrial against
       alternative hypothesis H1: pBaseline < pTrial.  Return the (one-tailed) p-value.

       zMultiplier: test z-value will be multiplied by this factor before computing a p-value.

       See http://en.wikipedia.org/wiki/Statistical_hypothesis_testing#Common_test_statistics,
       "Two-proportion z-test, pooled for d0 = 0".
    */
    zTest: function(zMultiplier) {
        var pooledStats = new ABTest.Proportion(
            this.baseline.numSuccesses + this.trial.numSuccesses,
            this.baseline.numSamples + this.trial.numSamples);
        var pooledPValue = pooledStats.pEstimate().value;
        var pooledVarianceOfDifference = (
                pooledPValue * (1 - pooledPValue)
                * (1.0 / this.baseline.numSamples + 1.0 / this.trial.numSamples));
        var pooledStandardErrorOfDifference = Math.sqrt(pooledVarianceOfDifference);
        var testZValue =
            Math.abs(this.differenceEstimate().value) / pooledStandardErrorOfDifference;
        var adjustedOneTailedPValue = this._normal.survival(testZValue * zMultiplier);
        return 2 * adjustedOneTailedPValue;
    },
};

// numTrials: number of trials to be compared to the baseline (i.e., not including the baseline)
ABTest.Experiment = function(numTrials, baselineNumSuccesses, baselineNumSamples, baseAlpha) {
    this._normal = new ABTest.NormalDistribution();
    this._baseline = new ABTest.Proportion(baselineNumSuccesses, baselineNumSamples);

    var numComparisons = Math.max(1, numTrials);
    // all z-values are two-tailed
    var baseZCriticalValue = this._normal.inverseSurvival(baseAlpha / 2);
    var alpha = baseAlpha / numComparisons // Bonferroni correction
    this._zCriticalValue = this._normal.inverseSurvival(alpha / 2);
    // to normalize for multiple testing, rather than scaling the hypothesis test's p-value, we
    // scale the z-value by this amount
    this._zMultiplier = baseZCriticalValue / this._zCriticalValue;
    // z critical value for confidence interval on individual proportions
    this._trialIntervalZCriticalValue = this._zCriticalValue / Math.sqrt(2)
}
ABTest.Experiment.prototype = {
    getBaselineProportion: function() {
        return this._baseline.pEstimate().valueWithInterval(
            this._trialIntervalZCriticalValue);
    },

    getResults: function(numSuccesses, numSamples) {
        var trial = new ABTest.Proportion(numSuccesses, numSamples);
        var comparison = new ABTest.ProportionComparison(this._baseline, trial);
        return {
            proportion: trial.pEstimate().valueWithInterval(
                this._trialIntervalZCriticalValue),
            relativeImprovement: comparison.differenceRatio().valueWithInterval(
                this._zCriticalValue),
            pValue: comparison.zTest(this._zMultiplier),
        };
    },
};
