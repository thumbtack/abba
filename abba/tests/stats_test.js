// Copyright (c) 2012 Thumbtack, Inc.

function addToBeNearMatcher(object) {
    object.addMatchers({
        // like toBeCloseTo(), but looks at absolute error rather than rounding to a fixed
        // precision
        toBeNear: function(expected, maxError) {
            return Math.abs(this.actual - expected) < maxError;
        },
    });
}

describe('NormalDistribution', function() {
    var MAX_ERROR = 1e-8;
    var normal = new Abba.NormalDistribution(1, 2);

    beforeEach(function() {
        addToBeNearMatcher(this);
    });

    it('computes density', function() {
        var expectedDensities = [
            [1, 0.19947114020071635],
            [3, 0.12098536225957168],
            [5, 0.026995483256594031],
            [-1, 0.12098536225957168],
        ];

        expectedDensities.forEach(function(values) {
            expect(normal.density(values[0])).toBeNear(values[1], MAX_ERROR);
        });
    });

    it('computes CDFs and survival functions', function() {
        var expectedCumulativeProbabilities = [
            [1, 0.5],
            [3, 0.84134474606854293],
            [5, 0.97724986805182079],
            [-1, 1 - 0.84134474606854293],
        ];

        expectedCumulativeProbabilities.forEach(function(values) {
            expect(normal.cdf(values[0])).toBeNear(values[1], MAX_ERROR);
            expect(normal.survival(values[0])).toBeNear(1 - values[1], MAX_ERROR);
        });
    });

    it('computes inverse CDFs and survival functions', function() {
        var expectedValues = [
            [0.5, 1],
            [0.75, 2.3489795003921632],
            [0.95, 4.2897072539029448],
            [0.05, 1 - 3.2897072539029448],
        ];

        expectedValues.forEach(function(values) {
            expect(normal.inverseCdf(values[0])).toBeNear(values[1], MAX_ERROR);
            expect(normal.inverseSurvival(values[0])).toBeNear(1 - (values[1] - 1), MAX_ERROR);
        });
    });
});

describe('BinomialDistribution', function() {
    var binomial = new Abba.BinomialDistribution(1000, 0.3);
    var MAX_ERROR = 5e-3;

    beforeEach(function() {
        addToBeNearMatcher(this);
    });

    it('computes mass', function() {
        var expectedMass = [
            [300, 0.02752100382127079],
            [310, 0.02152338347988187],
            [340, 0.00064472915988537168],
            [280, 0.01070077909763107],
        ];

        expectedMass.forEach(function(values) {
            expect(binomial.mass(values[0])).toBeNear(values[1], MAX_ERROR);
        });
    });

    it('computes CDFs and survival functions', function() {
        var expectedCumulativeProbabilities = [
            [300, 0.51559351981313983],
            [310, 0.76630504342015282],
            [340, 0.99716213728136105],
            [280, 0.088579522605989086],
        ];

        expectedCumulativeProbabilities.forEach(function(values) {
            expect(binomial.cdf(values[0])).toBeNear(values[1], MAX_ERROR);
            expect(binomial.survival(values[0])).toBeNear(1 - values[1], MAX_ERROR);
        });
    });

    it('computes inverse CDFs and survival functions', function() {
        var expectedValues = [
            [0.5, 300],
            [0.75, 310],
            [0.95, 324],
            [0.05, 276],
        ];

        expectedValues.forEach(function(values) {
            expect(binomial.inverseCdf(values[0])).toBeNear(values[1], 0.5);
            expect(binomial.inverseSurvival(values[0])).toBeNear(300 - (values[1] - 300), 0.5);
        });
    });
});

describe('Experiment', function() {
    var experiment = new Abba.Experiment(3, 20, 100, 0.05);

    it('computes the baseline proportion', function() {
        var proportion = experiment.getBaselineProportion();
        expect(proportion.value).toBe(20 / 100);
        expect(proportion.lowerBound).toBeCloseTo(0.12041099);
        expect(proportion.upperBound).toBeCloseTo(0.31211190);
    });

    it('computes experiment results', function() {
        var results = experiment.getResults(50, 150);
        expect(results.proportion.value).toBe(50 / 150);
        expect(results.proportion.lowerBound).toBeCloseTo(0.24862657);
        expect(results.relativeImprovement.value).toBeCloseTo(2/3);
        expect(results.relativeImprovement.lowerBound).toBeCloseTo(-0.04093375);
        expect(results.pValue).toBeCloseTo(0.05763145);
    });

    it('computes experiment results for large problems', function() {
        experiment = new Abba.Experiment(3, 50000, 100000, 0.05);
        var results = experiment.getResults(101000, 200000);
        expect(results.pValue).toBeCloseTo(0.02445128);
    });

    it('computes the correct p-value in the trivial case', function() {
        experiment = new Abba.Experiment(1, 0, 1, 0.05);
        var results = experiment.getResults(0, 10);
        expect(results.pValue).toBe(1);
    });
});
