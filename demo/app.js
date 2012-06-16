// Copyright (c) 2012 Thumbtack, Inc.

var Abba = (function(Abba, $, Hash) {

Abba.TextInputView = function($element) {
    this._$element = $element;
}
Abba.TextInputView.prototype = {
    getValue: function() {
        return this._$element.val();
    },

    setValue: function(value) {
        this._$element.val(value);
    }
};

Abba.CheckboxView = function($element) {
    this._$element = $element;
}
Abba.CheckboxView.prototype = {
    getValue: function() {
        return this._$element.attr('checked') === 'checked';
    },

    setValue: function(isChecked) {
        this._$element.attr('checked', isChecked);
    }
};

Abba.InputsView = function($form, historyIframe) {
    this._$form = $form;
    this._historyIframe = historyIframe;
    this.intervalConfidenceLevelInput =
        new Abba.TextInputView($form.find('.interval-confidence-level'));
    this.useMultipleTestCorrectionInput =
        new Abba.CheckboxView($form.find('.use-multiple-test-correction'));
}
Abba.InputsView.prototype = {
    setAddGroupHandler: function(callback) {
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
            numSamples: parseInt($row.find('.num-samples-input').val())
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

    _variationInputRows: function() {
        return this._$form.find('.input-row').not('.baseline-input-row');
    },

    getInputs: function() {
        var self = this;
        return {
            baseline: this._readInputRow(this._$form.find('.baseline-input-row')),
            variations: this._variationInputRows()
                .map(function() {
                    return self._readInputRow($(this));
                })
                .get()
        };
    },

    setInputs: function(inputs) {
        var self = this;
        self._writeInputRow(this._$form.find('.baseline-input-row'), inputs.baseline);

        this._variationInputRows().remove();
        inputs.variations.forEach(function(variation) {
            self._writeInputRow(self._createInputRow(), variation);
        });
    }
};

Abba.Presenter = function(abTestClass) {
    this.OPTION_LABEL = 'abba:';

    this._abbaClass = abTestClass;
    this._inputsView = undefined;
    this._$resultsContainer = undefined;
}
Abba.Presenter.prototype = {
    bind: function(inputsView, $resultsContainer) {
        this._inputsView = inputsView;
        // use of resultsContainer should be very limited, otherwise this class will be untestable
        this._$resultsContainer = $resultsContainer;

        var self = this;
        inputsView.setAddGroupHandler(function() { self._addGroup(); });
        inputsView.setComputeHandler(function() { self._triggerComputation(); });
        inputsView.setHistoryHandler(function(hash) { self._handleHistoryChange(hash); });
    },

    _chooseGroupName: function() {
        var inputs = this._inputsView.getInputs();
        var usedNames = {};
        usedNames[inputs.baseline.label] = true;
        inputs.variations.forEach(function(variation) {
            usedNames[variation.label] = true;
        });

        var index = 1;
        while (true) {
            var label = 'Variation ' + index;
            if (!(label in usedNames)) {
                return label;
            }
            index++;
        }
    },

    _addGroup: function() {
        this._inputsView.addInputRow(this._chooseGroupName());
    },

    _serializeState: function() {
        var data = {};
        function addRow(rowData) {
            data[rowData.label] = rowData.numSuccesses + ',' + rowData.numSamples;
        }
        var inputs = this._inputsView.getInputs();
        addRow(inputs.baseline);
        inputs.variations.forEach(function(variation) { addRow(variation); });

        function addOption(name, value) {
            data['abba:' + name] = value;
        }
        addOption(
            'intervalConfidenceLevel',
            this._inputsView.intervalConfidenceLevelInput.getValue()
        );
        addOption(
            'useMultipleTestCorrection',
            this._inputsView.useMultipleTestCorrectionInput.getValue()
        );

        return $.param(data);
    },

    _parseOption: function(name, valueString) {
        switch(name) {
            case 'intervalConfidenceLevel':
                this._inputsView.intervalConfidenceLevelInput.setValue(valueString)
                break;
            case 'useMultipleTestCorrection':
                this._inputsView.useMultipleTestCorrectionInput.setValue(valueString === 'true');
                break;
        }
    },

    _deserializeState: function(hash) {
        var variations = [];
        var self = this;
        hash.split('&').forEach(function(parameter_string) {
            var parts = parameter_string.split('=').map(function(piece) {
                return decodeURIComponent(piece.replace(/\+/g, ' '));
            });
            var colonSplit = parts[0].split(':');
            if (colonSplit[0] == 'abba') {
                self._parseOption(colonSplit[1], parts[1]);
            } else {
                var valueParts = parts[1].split(',').map(
                    function(value) { return parseInt(value); }
                );
                variations.push({
                    label: parts[0],
                    numSuccesses: valueParts[0],
                    numSamples: valueParts[1]
                });
            }
        });

        var baseline = variations.shift();
        this._inputsView.setInputs({baseline: baseline, variations: variations});
    },

    _triggerComputation: function() {
        this._inputsView.goToHash(this._serializeState());
    },

    _renderResults: function(state) {
        var inputs = this._inputsView.getInputs();
        var test = new this._abbaClass(inputs.baseline.label,
                                       inputs.baseline.numSuccesses,
                                       inputs.baseline.numSamples);
        test.setIntervalAlpha(
            1 - parseFloat(this._inputsView.intervalConfidenceLevelInput.getValue())
        );
        test.setMultipleTestCorrectionEnabled(
            this._inputsView.useMultipleTestCorrectionInput.getValue()
        );
        inputs.variations.forEach(function(variation) {
            test.addVariation(variation.label, variation.numSuccesses, variation.numSamples);
        });
        test.renderTo(this._$resultsContainer);
    },

    _handleHistoryChange: function(hash) {
        this._$resultsContainer.hide();
        if (hash) {
            this._deserializeState(hash);
            this._renderResults();
        } else {
            this._inputsView.setInputs({
                baseline: {label: 'Baseline'},
                variations: [{label: 'Variation 1'}]
            });
            this._inputsView.intervalConfidenceLevelInput.setValue(1 - Abba.DEFAULT_INTERVAL_ALPHA);
            this._inputsView.useMultipleTestCorrectionInput.setValue(true);
        }
    }
};

return Abba;
}(Abba || {}, jQuery, Hash));
