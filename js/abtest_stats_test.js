describe('NormalDistribution', function() {
    var normal = new NormalDistribution();

    beforeEach(function() {
        this.addMatchers({
            // like toBeCloseTo(), but looks at absolute error rather than rounding to some precision
            toBeNear: function(expected, maxError) {
                return Math.abs(this.actual - expected) < maxError;
            },
        });
    });

    it('computes CDFs and survival functions', function() {
        var MAX_ERROR = 7.5e-8;

        var expectedCumulativeProbabilities = {};
        expectedCumulativeProbabilities[0] = 0.5;
        expectedCumulativeProbabilities[1] = 0.84134474606854293;
        expectedCumulativeProbabilities[2] = 0.97724986805182079;
        expectedCumulativeProbabilities[-1] = 1 - expectedCumulativeProbabilities[1];

        for (var zValue in expectedCumulativeProbabilities) {
            expect(normal.cdf(zValue))
                .toBeNear(expectedCumulativeProbabilities[zValue], MAX_ERROR);
            expect(normal.survival(zValue))
                .toBeNear(1 - expectedCumulativeProbabilities[zValue], MAX_ERROR);
        }
    });

    it('computes inverse CDFs and survival functions', function() {
        var MAX_ERROR = 4.5e-4;

        var expectedZValues = {};
        expectedZValues[0.5] = 0;
        expectedZValues[0.75] = 0.67448975019608171;
        expectedZValues[0.95] = 1.6448536269514729;
        expectedZValues[0.05] = -expectedZValues[0.95];

        for (var probability in expectedZValues) {
            expect(normal.inverseCdf(probability))
                .toBeNear(expectedZValues[probability], MAX_ERROR);
            expect(normal.inverseSurvival(probability))
                .toBeNear(-expectedZValues[probability], MAX_ERROR);
        }
    });
});

describe('Experiment', function() {
    var experiment = new Experiment(3, 20, 1000, 0.05);

    it('computes the baseline proportion', function() {
        var proportion = experiment.getBaselineProportion();
        expect(proportion.value).toBe(0.02);
        expect(proportion.intervalWidth).toBeCloseTo(0.0074957);
        expect(proportion.range().lowerBound).toBeCloseTo(0.0125043);
        expect(proportion.range().upperBound).toBeCloseTo(0.0274957);
    });

    it('computes experiment results', function() {
        var results = experiment.getResults(50, 2000);
        expect(results.proportion.value).toBeCloseTo(0.025);
        expect(results.proportion.intervalWidth).toBeCloseTo(0.0059097);
        expect(results.relativeImprovement.value).toBeCloseTo(0.25);
        expect(results.relativeImprovement.intervalWidth).toBeCloseTo(0.6748677);
        expect(results.pValue).toBeCloseTo(0.4838344);
    });
});
