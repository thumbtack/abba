var BASELINE_ALPHA = 0.05;

var RESULT_ROW_HTML = ' \
<tr class="result-row"> \
  <th class="bucket-name"></th> \
  <td class="yes"></td> \
  <td class="total"></td> \
  <td class="conversion-numeric"> \
    <span class="base"></span> \
    <span class="error">&plusmn; <span></span></span> \
  </td> \
  <td class="conversion-visual"></td> \
  <td class="p-value"></td> \
  <td class="improvement"> \
    <span class="base"></span> \
    <span class="error">&plusmn; <span></span></span> \
  </td> \
</tr>';

var RESULT_TABLE_HTML = ' \
<table> \
    <thead> \
        <tr> \
            <th></th> \
            <th>Successes</th> \
            <th>Total</th> \
            <th colspan="2">Success Rate</th> \
            <th>p-value</th> \
            <th>Improvement</th> \
        </tr> \
    </thead> \
    <tbody class="result-table"> \
    </tbody> \
</table>';

function Formatter() {}
Formatter.prototype = {
    describeNumber: function(number, decimalSpots) {
        if (!decimalSpots) {
            if (number % 1 == 0) {
                decimalSpots = 0;
            } else {
                decimalSpots = 1;
            }
        }

        var numberString = String(number.toFixed(decimalSpots));
        var parts = numberString.split('.');
        var whole = parts[0];

        var pattern = /(\d+)(\d{3})(,|$)/;
        while (pattern.test(whole)) {
            whole = whole.replace(pattern, '$1,$2');
        }

        numberString = (parts.length > 1) ? whole + '.' + parts[1] : whole;
        return numberString;
    },

    _round: function(value, places) {
        var factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    },

    _getDefaultPlaces: function(ratio) {
        if (Math.abs(ratio) < 0.01) {
            return 2;
        } else if (Math.abs(ratio) < 0.1) {
            return 1;
        } else {
            return 0;
        }
    },

    percent: function(ratio, places) {
        if (places === undefined) {
            places = this._getDefaultPlaces(ratio);
        }
        return this._round(100 * ratio, places) + '%';
    },
}

function ResultRowView($row, formatter) {
    this._$row = $row;
    this._formatter = formatter;
}
ResultRowView.prototype = {
    _renderInterval: function(valueWithInterval, $container) {
        $container
            .find('.base').text(this._formatter.percent(valueWithInterval.value)).end()
            .find('.error > span').text(this._formatter.percent(valueWithInterval.intervalWidth));
    },

    renderConversion: function(numSuccesses, numSamples, rate) {
        this._$row
            .find('.yes').text(this._formatter.describeNumber(numSuccesses)).end()
            .find('.total').text(this._formatter.describeNumber(numSamples));
        this._renderInterval(rate, this._$row.find('.conversion-numeric'));
    },

    renderOutcome: function(pValue, improvement) {
        var pValueText = this._formatter.percent(pValue);
        if (pValueText == '0%') {
            pValueText = '< 0.01%';
        }
        this._$row.find('.p-value').text(pValueText);
        this._renderInterval(improvement, this._$row.find('.improvement'));
    },

    blankOutcome: function() {
        this._$row.find('.p-value, .improvement').html('&mdash;');
    },

    renderConversionRange: function(range, baselineRange, overallRange) {
        var canvas = this._$row.find('.conversion-visual');
        var width = 200;
        var height = 25;
        var scale = pv.Scale
            .linear(overallRange.lowerBound, overallRange.upperBound)
            .range(0, width);
        var colors = pv.colors(
            '#D8D8D8',
            '#DF1210', // : '#E5C91E',
            '#48E000'  // : '#E5C91E'
        );

        var panel = new pv.Panel()
            .width(width)
            .height(height)
            .margin(10)
            .canvas(canvas[0]);

        var ranges = [
            range,
            {
                lowerBound: range.lowerBound,
                upperBound: Math.min(range.upperBound, baselineRange.lowerBound)
            },
            {
                lowerBound: Math.max(range.lowerBound, baselineRange.upperBound),
                upperBound: range.upperBound
            }
        ];

        // Range indicators
        panel.add(pv.Bar)
            .data(ranges)
            .top(0)
            .height(height)
            .left(function(data) { return scale(data.lowerBound); })
            .width(function(data) { return scale(data.upperBound) - scale(data.lowerBound); })
            .fillStyle(colors.by(function() { return this.index; }));

        // End marks
        var endMarkHeight = 7;
        panel.add(pv.Rule)
            .data([overallRange.lowerBound, overallRange.upperBound])
            .visible(function(data) { return data; })
            .left(function(data) { var l = scale(data); return (this.index == 0) ? l - 1 : l; })
            .top(height / 2 - endMarkHeight / 2)
            .height(endMarkHeight)
            .strokeStyle('#444')
            .anchor(function() { return (this.index == 0) ? 'left' : 'right'; })
            .add(pv.Label)
            .font('12px "Droid Sans Mono"')
            .textStyle('#444')
            .textBaseline('middle')
            .text(function() { return (this.index == 0) ? '-' : '+'; });

        // Center line
        panel.add(pv.Rule)
            .left(0)
            .top(height / 2)
            .width(width)
            .strokeStyle('#444');

        panel.render();
    },
};

// Handles all DOM manipulation and event binding
function ResultsView($container) {
    this._$container = $container;
    this._formatter = new Formatter();

    $container.html(RESULT_TABLE_HTML);
    $container.hide();
}
ResultsView.prototype = {
    addResultRow: function(label) {
        this._$container.show();

        var $resultTable = this._$container.find('.result-table');
        $resultTable.append(RESULT_ROW_HTML);
        var $resultRow = $resultTable.children().last();
        $resultRow.find('.bucket-name').text(label);
        return new ResultRowView($resultRow, this._formatter);
    },

    clearResults: function() {
        this._$container.find('.result-row').remove();
        this._$container.hide();
    },
};


function ResultsPresenter(experimentClass) {
    this._view = undefined;
    this._experimentClass = experimentClass;
}
ResultsPresenter.prototype = {
    bind: function(view) {
        this._view = view;
    },

    _computeResults: function(allInputs) {
        var experiment = new this._experimentClass(allInputs.trials.length,
                                                   allInputs.baseline.numSuccesses,
                                                   allInputs.baseline.numSamples,
                                                   BASELINE_ALPHA);

        var baselineProportion = experiment.getBaselineProportion();
        var overallConversionBounds = {lowerBound: baselineProportion.range().lowerBound,
                                       upperBound: baselineProportion.range().upperBound};
        var trials = allInputs.trials.map(function(trial) {
            var outcome = experiment.getResults(trial.numSuccesses, trial.numSamples);
            overallConversionBounds.lowerBound = Math.min(overallConversionBounds.lowerBound,
                                                          outcome.proportion.range().lowerBound)
            overallConversionBounds.upperBound = Math.max(overallConversionBounds.upperBound,
                                                          outcome.proportion.range().upperBound)
            return {inputs: trial, outcome: outcome};
        });

        return {
            baselineProportion: baselineProportion,
            overallConversionBounds: overallConversionBounds,
            trials: trials
        };
    },

    computeAndDisplayResults: function(allInputs) {
        this._view.clearResults();
        var results = this._computeResults(allInputs);

        var renderConversionWithRange = function(resultRow, inputs, proportion) {
            resultRow.renderConversion(inputs.numSuccesses, inputs.numSamples, proportion)
            resultRow.renderConversionRange(proportion.range(),
                                            results.baselineProportion.range(),
                                            results.overallConversionBounds);
        };

        var baselineResultRow = this._view.addResultRow(allInputs.baseline.label);
        renderConversionWithRange(baselineResultRow,
                                  allInputs.baseline,
                                  results.baselineProportion);
        baselineResultRow.blankOutcome();

        var self = this;
        results.trials.forEach(function(trial_results) {
            var resultRow = self._view.addResultRow(trial_results.inputs.label);
            renderConversionWithRange(resultRow,
                                      trial_results.inputs,
                                      trial_results.outcome.proportion);
            resultRow.renderOutcome(trial_results.outcome.pValue,
                                    trial_results.outcome.relativeImprovement);
        });
    },
};

function ABTest(baselineName, baselineNumSuccesses, baselineNumSamples) {
    this._baseline = {
        name: baselineName,
        numSuccesses: baselineNumSuccesses,
        numSamples: baselineNumSamples,
    };
    this._trials = [];
}
ABTest.prototype = {
    addTrial: function(name, numSuccesses, numSamples) {
        this._trials.push({name: name, numSuccesses: numSuccesses, numSamples: numSamples});
    },

    renderTo: function(container) {
        var presenter = new ResultsPresenter(Experiment);
        presenter.bind(new ResultsView($(container)));
        presenter.computeAndDisplayResults({baseline: this._baseline, trials: this._trials});
    },

    getResults: function() {
        var experiment = new Experiment(this._trials.length,
                                        this._baseline.numSuccesses,
                                        this._baseline.numSamples,
                                        BASELINE_ALPHA);
        results = {}
        results[this._baseline.name] = experiment.getBaselineProportion();
        this._trials.forEach(function(trial) {
            results[trial.name] = experiment.getResults(trial.numSuccesses, trial.numSamples);
        });
        return results;
    },
};
