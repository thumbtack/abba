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
    var StubExperiment = function(numTrials,
                                  baselineNumSuccesses,
                                  baselineNumSamples,
                                  baseAlpha) {
        experimentParams.numTrials = numTrials;
        experimentParams.baselineNumSuccesses = baselineNumSuccesses;
        experimentParams.baselineNumSamples = baselineNumSamples;
        experimentParams.trialData = [];

        this.getBaselineProportion = function() {
            return new Abba.ValueWithInterval(0.5, 0.2);
        };

        this.getResults = function(numSuccesses, numSamples) {
            experimentParams.trialData.push([numSuccesses, numSamples]);
            return {
                proportion: new Abba.ValueWithInterval(0.6, 0.3),
                relativeImprovement: new Abba.ValueWithInterval(1.2, 0.15),
                pValue: 0.123,
            };
        };
    };

    var FakeView = function() {
        this.hasBeenCleared = false;
        this.resultRows = [];

        this.addResultRow = function(label) {
            var row = {
                renderConversion: function(numSuccesses, numSamples, rate) {
                    this.numSuccesses = numSuccesses;
                    this.numSamples = numSamples;
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
                numSamples: 20,
            },
            trials: [{
                label: 'Trial 1',
                numSuccesses: 60,
                numSamples: 100,
            }],
        });

        expect(experimentParams.numTrials).toBe(1);
        expect(experimentParams.baselineNumSuccesses).toBe(10);
        expect(experimentParams.baselineNumSamples).toBe(20);
        expect(experimentParams.trialData).toEqual([[60, 100]]);

        expect(view.resultRows.length).toBe(2);

        var baselineRow = view.resultRows[0];
        expect(baselineRow.label).toBe('Baseline');
        expect(baselineRow.row.numSuccesses).toBe(10);
        expect(baselineRow.row.numSamples).toBe(20);
        expect(baselineRow.row.rate.value).toBe(0.5);
        expect(baselineRow.row.rate.intervalWidth).toBe(0.2);
        expect(baselineRow.row.isBlankOutcome).toBeTruthy();
        expect(baselineRow.row.range.lowerBound).toBeCloseTo(0.3);
        expect(baselineRow.row.range.upperBound).toBeCloseTo(0.7);
        expect(baselineRow.row.overallRange.lowerBound).toBeCloseTo(0.3);
        expect(baselineRow.row.overallRange.upperBound).toBeCloseTo(0.9);

        var trialRow = view.resultRows[1];
        expect(trialRow.label).toBe('Trial 1');
        expect(trialRow.row.numSuccesses).toBe(60);
        expect(trialRow.row.numSamples).toBe(100);
        expect(trialRow.row.rate.value).toBe(0.6);
        expect(trialRow.row.rate.intervalWidth).toBe(0.3);
        expect(trialRow.row.pValue).toBe(0.123);
        expect(trialRow.row.improvement.value).toBe(1.2);
        expect(trialRow.row.improvement.intervalWidth).toBe(0.15);
        expect(trialRow.row.baselineRange.lowerBound).toBeCloseTo(0.3);
        expect(trialRow.row.baselineRange.upperBound).toBeCloseTo(0.7);
    });
});

describe('Abba', function() {
    it('gets raw results', function() {
        var test = new Abba.Abba('my baseline', 1, 2);
        test.addTrial('my trial', 3, 4);
        var results = test.getResults();
        expect(results['my baseline'].value).toBe(0.5);
        expect(results['my trial'].proportion.value).toBe(0.75);
    });
});
