ABTest.InputsView = function($form, historyIframe) {
    this._$form = $form;
    this._historyIframe = historyIframe;
}
ABTest.InputsView.prototype = {
    setAddTrialHandler: function(callback) {
        this._$form.find('.add-input-link').click(function(event) {
            event.preventDefault()
            callback();
        });
    },

    setComputeHandler: function(callback) {
        this._$form.submit(function(event) {
            event.preventDefault();
            callback();
        });
    },

    setHistoryHandler: function(callback) {
        Hash.init(callback, this._historyIframe);
    },

    goToHash: function(hash) {
        Hash.go(hash);
    },

    _createInputRow: function() {
        var $row = this._$form.find('.baseline-input-row')
            .clone()
            .removeClass('baseline-input-row')
            .find('input').val('').end()
            .appendTo(this._$form.find('.inputs-table'));
        $row.find('.remove-input-link')
            .show()
            .click(function(event) {
                event.preventDefault();
                $row.remove();
            });
        return $row;
    },

    _readInputRow: function($row) {
        return {
            label: $row.find('.label-input').val(),
            numSuccesses: parseInt($row.find('.num-successes-input').val()),
            numSamples: parseInt($row.find('.num-samples-input').val()),
        };
    },

    _writeInputRow: function($row, values) {
        $row.find('.label-input').val(values.label).end()
            .find('.num-successes-input').val(values.numSuccesses).end()
            .find('.num-samples-input').val(values.numSamples);
    },

    addInputRow: function(name) {
        var $row = this._createInputRow();
        $row.find('.label-input').val(name);
    },

    _trialInputRows: function() {
        return this._$form.find('.input-row').not('.baseline-input-row');
    },

    getInputs: function() {
        var self = this;
        return {
            baseline: this._readInputRow(this._$form.find('.baseline-input-row')),
            trials: this._trialInputRows()
                .map(function() {
                    return self._readInputRow($(this));
                })
                .get(),
        };
    },

    setInputs: function(inputs) {
        var self = this;
        self._writeInputRow(this._$form.find('.baseline-input-row'), inputs.baseline);

        this._trialInputRows().remove();
        inputs.trials.forEach(function(trial) {
            self._writeInputRow(self._createInputRow(), trial);
        });
    },
};

ABTest.Presenter = function(abTestClass) {
    this._abTestClass = abTestClass;
    this._inputsView = undefined;
    this._$resultsContainer = undefined;
}
ABTest.Presenter.prototype = {
    bind: function(inputsView, $resultsContainer) {
        this._inputsView = inputsView;
        // use of resultsContainer should be very limited, otherwise this class will be untestable
        this._$resultsContainer = $resultsContainer;

        var self = this;
        inputsView.setAddTrialHandler(function() { self._addTrial(); });
        inputsView.setComputeHandler(function() { self._triggerComputation(); });
        inputsView.setHistoryHandler(function(hash) { self._handleHistoryChange(hash); });
    },

    _chooseTrialName: function() {
        var inputs = this._inputsView.getInputs();
        var usedNames = {};
        usedNames[inputs.baseline.label] = true;
        inputs.trials.forEach(function(trial) {
            usedNames[trial.label] = true;
        });

        var index = 1;
        while (true) {
            var label = 'Trial ' + index;
            if (!(label in usedNames)) {
                return label;
            }
            index++;
        }
    },

    _addTrial: function() {
        this._inputsView.addInputRow(this._chooseTrialName());
    },

    _serializeInputs: function(inputs) {
        var data = {};
        function addRow(rowData) {
            data[rowData.label] = rowData.numSuccesses + ',' + rowData.numSamples;
        }
        addRow(inputs.baseline);
        inputs.trials.forEach(function(trial) { addRow(trial); });
        return $.param(data);
    },

    _deserializeInputs: function(hash) {
        var trials = [];
        hash.split('&').forEach(function(parameter_string) {
            var parts = parameter_string.split('=').map(function(piece) {
                return decodeURIComponent(piece.replace('+', ' '));
            });
            var valueParts = parts[1].split(',').map(function(value) { return parseInt(value); });
            trials.push({
                label: parts[0],
                numSuccesses: valueParts[0],
                numSamples: valueParts[1]
            });
        });

        var baseline = trials.shift();
        return {
            baseline: baseline,
            trials: trials,
        };
    },

    _triggerComputation: function() {
        this._inputsView.goToHash(this._serializeInputs(this._inputsView.getInputs()));
    },

    _renderResults: function(inputs) {
        var test = new this._abTestClass(inputs.baseline.label,
                                         inputs.baseline.numSuccesses,
                                         inputs.baseline.numSamples);
        inputs.trials.forEach(function(trial) {
            test.addTrial(trial.label, trial.numSuccesses, trial.numSamples);
        });
        test.renderTo(this._$resultsContainer);
    },

    _handleHistoryChange: function(hash) {
        this._$resultsContainer.hide();
        if (hash) {
            var inputs = this._deserializeInputs(hash);
            this._inputsView.setInputs(inputs);
            this._renderResults(inputs);
        } else {
            this._inputsView.setInputs({
                baseline: {label: 'Baseline'},
                trials: [{label: 'Trial 1'}],
            });
        }
    },
};
