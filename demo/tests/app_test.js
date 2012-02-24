describe('Presenter', function() {
    var FakeView = function() {
        this.addTrialCallback = undefined;
        this.computeCallback = undefined;
        this.historyCallback = undefined;
        this.historyHash = undefined;
        this.addedInputs = [];
        this.inputsThatWereSet = undefined;

        this.setAddTrialHandler = function(callback) {
            this.addTrialCallback = callback;
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
                trials: [{
                    label: 'Trial 1',
                    numSuccesses: 60,
                    numSamples: 100,
                }],
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

    var renderedContainer = undefined;
    var renderedData = undefined;

    var FakeAbTest = function(baselineLabel, baselineNumSuccesses, baselineNumSamples) {
        this._baseline = {
            name: baselineLabel,
            numSuccesses: baselineNumSuccesses,
            numSamples: baselineNumSamples,
        };
        this._trials = [];
        this._renderedContainer = undefined;

        this.addTrial = function(name, numSuccesses, numSamples) {
            this._trials.push({name: name, numSuccesses: numSuccesses, numSamples: numSamples});
        };

        this.renderTo = function(container) {
            renderedContainer = container;
            renderedData = {baseline: this._baseline, trials: this._trials};
        };
    };

    var view = undefined;
    var resultsContainer = undefined;
    var presenter = new Abba.Presenter(FakeAbTest);

    beforeEach(function() {
        renderedContainer = undefined;
        renderedData = undefined;
        view = new FakeView();
        resultsContainer = new FakeElement();
        presenter.bind(view, resultsContainer);
    });

    it('adds trials', function() {
        view.addTrialCallback();
        expect(view.addedInputs).toEqual(['Trial 2']);
    });

    it('computes results', function() {
        view.computeCallback();

        expect(resultsContainer._hidden).toBeTruthy();
        expect(renderedContainer).toBe(resultsContainer);

        expect(renderedData.trials.length).toBe(1);
        expect(renderedData.baseline.name).toBe('Baseline');
        expect(renderedData.baseline.numSuccesses).toBe(10);
        expect(renderedData.baseline.numSamples).toBe(20);
        expect(renderedData.trials[0].name).toBe('Trial 1');
        expect(renderedData.trials[0].numSuccesses).toBe(60);
        expect(renderedData.trials[0].numSamples).toBe(100);
    });

    it('handles history', function() {
        view.computeCallback();
        var oldView = view;

        // "Reload" the app
        view = new FakeView();
        presenter = new Abba.Presenter(FakeAbTest);
        presenter.bind(view, resultsContainer);

        view.historyCallback(oldView.historyHash);
        expect(view.inputsThatWereSet).toEqual(oldView.getInputs());
    });
});
