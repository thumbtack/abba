// Copyright (c) 2012 Thumbtack, Inc.

describe('Formatter', function() {
    var formatter = new Abba.Formatter();

    it('formats numbers', function() {
        expect(formatter.describeNumber(1234567.89012, 2)).toBe('1,234,567.89');
    });

    it('formats percents', function() {
        expect(formatter.percent(0.123456)).toBe('12%');
        expect(formatter.percent(0.0123456)).toBe('1.2%');
        expect(formatter.percent(0.00123456)).toBe('0.12%');
    });
});

describe('ResultsPresenter', function() {
    var experimentParams;
    var StubExperiment = function(numVariations,
                                  baselineNumSuccesses,
                                  baselineNumTrials,
                                  baseAlpha) {
        experimentParams.numVariations = numVariations;
        experimentParams.baselineNumSuccesses = baselineNumSuccesses;
        experimentParams.baselineNumTrials = baselineNumTrials;
        experimentParams.variationData = [];

        this.getBaselineProportion = function() {
            return new Abba.ValueWithInterval(0.5, 0.3, 0.7);
        };

        this.getResults = function(numSuccesses, numTrials) {
            experimentParams.variationData.push([numSuccesses, numTrials]);
            return {
                proportion: new Abba.ValueWithInterval(0.6, 0.3, 0.9),
                relativeImprovement: new Abba.ValueWithInterval(1.2, 1.05, 1.35),
                pValue: 0.123,
            };
        };
    };

    var FakeView = function() {
        this.hasBeenCleared = false;
        this.resultRows = [];

        this.addResultRow = function(label) {
            var row = {
                renderConversion: function(numSuccesses, numTrials, rate) {
                    this.numSuccesses = numSuccesses;
                    this.numTrials = numTrials;
                    this.rate = rate;
                },

                renderOutcome: function(pValue, improvement) {
                    this.pValue = pValue;
                    this.improvement = improvement;
                },

                blankOutcome: function() {
                    this.isBlankOutcome = true;
                },

                renderConversionRange: function(range, baselineRange, overallRange) {
                    this.range = range;
                    this.baselineRange = baselineRange;
                    this.overallRange = overallRange;
                },
            };
            this.resultRows.push({label: label, row: row});
            return row;
        };

        this.clearResults = function() {
            this.hasBeenCleared = true;
        };
    };

    var view = undefined;
    var presenter = new Abba.ResultsPresenter(StubExperiment);

    beforeEach(function() {
        experimentParams = {};
        view = new FakeView();
        presenter.bind(view);
    });

    it('computes results', function() {
        presenter.computeAndDisplayResults({
            baseline: {
                label: 'Baseline',
                numSuccesses: 10,
                numTrials: 20,
            },
            variations: [{
                label: 'Variation 1',
                numSuccesses: 60,
                numTrials: 100,
            }],
        });

        expect(experimentParams.numVariations).toBe(1);
        expect(experimentParams.baselineNumSuccesses).toBe(10);
        expect(experimentParams.baselineNumTrials).toBe(20);
        expect(experimentParams.variationData).toEqual([[60, 100]]);

        expect(view.resultRows.length).toBe(2);

        var baselineRow = view.resultRows[0];
        expect(baselineRow.label).toBe('Baseline');
        expect(baselineRow.row.numSuccesses).toBe(10);
        expect(baselineRow.row.numTrials).toBe(20);
        expect(baselineRow.row.rate.value).toBe(0.5);
        expect(baselineRow.row.rate.lowerBound).toBe(0.3);
        expect(baselineRow.row.isBlankOutcome).toBeTruthy();
        expect(baselineRow.row.range.lowerBound).toBeCloseTo(0.3);
        expect(baselineRow.row.range.upperBound).toBeCloseTo(0.7);
        expect(baselineRow.row.overallRange.lowerBound).toBeCloseTo(0.3);
        expect(baselineRow.row.overallRange.upperBound).toBeCloseTo(0.9);

        var variationRow = view.resultRows[1];
        expect(variationRow.label).toBe('Variation 1');
        expect(variationRow.row.numSuccesses).toBe(60);
        expect(variationRow.row.numTrials).toBe(100);
        expect(variationRow.row.rate.value).toBe(0.6);
        expect(variationRow.row.rate.lowerBound).toBe(0.3);
        expect(variationRow.row.pValue).toBe(0.123);
        expect(variationRow.row.improvement.value).toBe(1.2);
        expect(variationRow.row.improvement.lowerBound).toBe(1.05);
        expect(variationRow.row.baselineRange.lowerBound).toBeCloseTo(0.3);
        expect(variationRow.row.baselineRange.upperBound).toBeCloseTo(0.7);
    });
});

describe('Abba', function() {
    it('gets raw results', function() {
        var test = new Abba.Abba('my baseline', 1000, 2000);
        test.addVariation('my variation', 3000, 4000);
        var results = test.getResults();
        expect(results['my baseline'].value).toBeCloseTo(0.5);
        expect(results['my variation'].proportion.value).toBeCloseTo(0.75);
    });
});
