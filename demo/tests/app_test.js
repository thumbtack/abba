describe('Presenter', function() {
    var FakeView = function() {
        this.addGroupCallback = undefined;
        this.computeCallback = undefined;
        this.historyCallback = undefined;
        this.historyHash = undefined;
        this.addedInputs = [];
        this.inputsThatWereSet = undefined;

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

    var renderedContainer = undefined;
    var renderedData = undefined;

    var FakeAbTest = function(baselineLabel, baselineNumSuccesses, baselineNumSamples) {
        this._baseline = {
            name: baselineLabel,
            numSuccesses: baselineNumSuccesses,
            numSamples: baselineNumSamples,
        };
        this._variations = [];
        this._renderedContainer = undefined;

        this.addVariation = function(name, numSuccesses, numSamples) {
            this._variations.push({name: name, numSuccesses: numSuccesses, numSamples: numSamples});
        };

        this.renderTo = function(container) {
            renderedContainer = container;
            renderedData = {baseline: this._baseline, variations: this._variations};
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

    it('adds groups', function() {
        view.addGroupCallback();
        expect(view.addedInputs).toEqual(['Variation 2']);
    });

    it('computes results', function() {
        view.computeCallback();

        expect(resultsContainer._hidden).toBeTruthy();
        expect(renderedContainer).toBe(resultsContainer);

        expect(renderedData.variations.length).toBe(2);
        expect(renderedData.baseline.name).toBe('Baseline');
        expect(renderedData.baseline.numSuccesses).toBe(10);
        expect(renderedData.baseline.numSamples).toBe(20);
        expect(renderedData.variations[0].name).toBe('Variation 1');
        expect(renderedData.variations[0].numSuccesses).toBe(60);
        expect(renderedData.variations[0].numSamples).toBe(100);
        expect(renderedData.variations[1].name).toBe('Variation 1 <2> + 3');
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
