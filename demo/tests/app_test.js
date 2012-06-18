// Copyright (c) 2012 Thumbtack, Inc.

describe('Presenter', function() {
    var FakeInputView = function() {
        this.value = null;

        this.getValue = function() {
            return this.value;
        };

        this.setValue = function(value) {
            this.value = value;
        };
    };

    var FakeView = function() {
        this.addGroupCallback = undefined;
        this.computeCallback = undefined;
        this.historyCallback = undefined;
        this.historyHash = undefined;
        this.addedInputs = [];
        this.inputsThatWereSet = undefined;

        this.intervalConfidenceLevelInput = new FakeInputView();
        this.intervalConfidenceLevelInput.value = '0.8';
        this.useMultipleTestCorrectionInput = new FakeInputView();
        this.useMultipleTestCorrectionInput.value = false;

        this.setAddGroupHandler = function(callback) {
            this.addGroupCallback = callback;
        };

        this.setComputeHandler = function(callback) {
            this.computeCallback = callback;
        };

        this.setHistoryHandler = function(callback) {
            this.historyCallback = callback;
        },

        this.goToHash = function(hash) {
            this.historyHash = hash;
            this.historyCallback(hash);
        },

        this.addInputRow = function(name) {
            this.addedInputs.push(name);
        };

        this.getInputs = function() {
            return {
                baseline: {
                    label: 'Baseline',
                    numSuccesses: 10,
                    numSamples: 20,
                },
                variations: [
                    {label: 'Variation 1',
                     numSuccesses: 60,
                     numSamples: 100},
                    {label: 'Variation 1 <2> + 3', // test some special characters
                     numSuccesses: 3,
                     numSamples: 4},
                ],
            };
        };

        this.setInputs = function(inputs) {
            this.inputsThatWereSet = inputs;
        };
    };

    var FakeElement = function() {
        this._hidden = false;

        this.hide = function() {
            this._hidden = true;
        };
    };

    var fakeAbbaInstance = undefined;

    var FakeAbba = function(baselineLabel, baselineNumSuccesses, baselineNumSamples) {
        fakeAbbaInstance = this;

        this._baseline = {
            name: baselineLabel,
            numSuccesses: baselineNumSuccesses,
            numSamples: baselineNumSamples,
        };
        this._variations = [];
        this._renderedContainer = undefined;
        this._renderedData = undefined;
        this._intervalAlpha = undefined;
        this._useMultipleTestCorrection = undefined;

        this.setIntervalAlpha = function(alpha) {
            this._intervalAlpha = alpha;
        },

        this.setMultipleTestCorrectionEnabled = function(isEnabled) {
            this._useMultipleTestCorrection = isEnabled;
        },

        this.addVariation = function(name, numSuccesses, numSamples) {
            this._variations.push({name: name, numSuccesses: numSuccesses, numSamples: numSamples});
        };

        this.renderTo = function(container) {
            this._renderedContainer = container;
            this._renderedData = {baseline: this._baseline, variations: this._variations};
        };
    };

    var view = undefined;
    var resultsContainer = undefined;
    var presenter = new Abba.Presenter(FakeAbba);

    beforeEach(function() {
        fakeAbbaInstance = undefined;
        view = new FakeView();
        resultsContainer = new FakeElement();
        presenter.bind(view, resultsContainer);
    });

    it('adds groups', function() {
        view.addGroupCallback();
        expect(view.addedInputs).toEqual(['Variation 2']);
    });

    it('computes results', function() {
        view.computeCallback();

        expect(resultsContainer._hidden).toBeTruthy();
        expect(fakeAbbaInstance._intervalAlpha).toBeCloseTo(0.2);
        expect(fakeAbbaInstance._useMultipleTestCorrection).toBeFalsy();
        expect(fakeAbbaInstance._renderedContainer).toBe(resultsContainer);

        expect(fakeAbbaInstance._renderedData.variations.length).toBe(2);
        expect(fakeAbbaInstance._renderedData.baseline.name).toBe('Baseline');
        expect(fakeAbbaInstance._renderedData.baseline.numSuccesses).toBe(10);
        expect(fakeAbbaInstance._renderedData.baseline.numSamples).toBe(20);
        expect(fakeAbbaInstance._renderedData.variations[0].name).toBe('Variation 1');
        expect(fakeAbbaInstance._renderedData.variations[0].numSuccesses).toBe(60);
        expect(fakeAbbaInstance._renderedData.variations[0].numSamples).toBe(100);
        expect(fakeAbbaInstance._renderedData.variations[1].name).toBe('Variation 1 <2> + 3');
    });

    it('handles history', function() {
        view.computeCallback();
        var oldView = view;

        // "Reload" the app
        view = new FakeView();
        view.intervalConfidenceLevelInput.value = undefined;
        view.useMultipleTestCorrectionInput.value = undefined;
        presenter = new Abba.Presenter(FakeAbba);
        presenter.bind(view, resultsContainer);

        view.historyCallback(oldView.historyHash);
        expect(view.inputsThatWereSet).toEqual(oldView.getInputs());
        expect(view.intervalConfidenceLevelInput.value).toBe('0.8');
        expect(view.useMultipleTestCorrectionInput.value).toBe(false);
    });

    it('allows percentage confidence level input', function() {
        view.intervalConfidenceLevelInput.value = '97';
        view.computeCallback();
        expect(fakeAbbaInstance._intervalAlpha).toBeCloseTo(0.03);
    });
});
