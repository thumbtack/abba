// Copyright (c) 2012 Thumbtack, Inc.

var Abba = (function(Abba, $, pv) {

Abba.DEFAULT_INTERVAL_ALPHA = 0.05;

Abba.INTERVAL_HTML = ' \
<div class="interval"> \
  <div class="error"><span class="lower-bound"></span> &ndash; <span class="upper-bound"></span></div> \
  <span class="base">(<span class="base-value"></span>)</span> \
</div>';


Abba.RESULT_ROW_HTML = ' \
<tr class="result-row"> \
  <th class="bucket-name"></th> \
  <td class="yes"></td> \
  <td class="total"></td> \
  <td class="conversion-numeric"></td> \
  <td class="conversion-visual"></td> \
  <td class="p-value"></td> \
  <td class="improvement"></td> \
</tr>';

Abba.RESULT_TABLE_HTML = ' \
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

Abba.RESULT_COLORS = {
    neutral: '#B8B8B8',
    lose: '#DF1210',
    win: '#48E000'
};

Abba.Formatter = function() {}
Abba.Formatter.prototype = {
    describeNumber: function(number, decimalSpots) {
        if (!decimalSpots) {
            if (number % 1 === 0) {
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
        if (ratio === Infinity || ratio === -Infinity) {
            return 'N/A';
        }
        if (places === undefined) {
            places = this._getDefaultPlaces(ratio);
        }
        return this._round(100 * ratio, places) + '%';
    },

    formatPValue: function(pValue) {
        if (pValue < 0.0001) {
            return '< 0.0001';
        } else {
            return pValue.toFixed(this._getDefaultPlaces(pValue) + 2);
        }
    }
}

Abba.ResultRowView = function($row, formatter) {
    this._$row = $row;
    this._formatter = formatter;
}
Abba.ResultRowView.prototype = {
    _renderInterval: function(valueWithInterval, $container) {
        $container
            .html(Abba.INTERVAL_HTML)
            .find('.base-value').text(this._formatter.percent(valueWithInterval.value)).end()
            .find('.error > .lower-bound')
                .text(this._formatter.percent(valueWithInterval.lowerBound)).end()
            .find('.error > .upper-bound')
                .text(this._formatter.percent(valueWithInterval.upperBound));
    },

    _supportsSvg: function(document) {
        var div = document.createElement('div');
        div.innerHTML = '<svg/>';
        return (div.firstChild && div.firstChild.namespaceURI) == 'http://www.w3.org/2000/svg';
    },

    _clampRate: function(rate) {
        function clamp(value) {
            return Math.max(0, Math.min(1, value));
        }
        return new Abba.ValueWithInterval(rate.value, clamp(rate.lowerBound), clamp(rate.upperBound));
    },

    renderConversion: function(numSuccesses, numTrials, rate) {
        this._$row
            .find('.yes').text(this._formatter.describeNumber(numSuccesses)).end()
            .find('.total').text(this._formatter.describeNumber(numTrials));
        this._renderInterval(this._clampRate(rate), this._$row.find('.conversion-numeric'));
    },

    renderOutcome: function(pValue, improvement) {
        this._$row.find('.p-value').text(this._formatter.formatPValue(pValue));
        this._renderInterval(improvement, this._$row.find('.improvement'));
    },

    blankOutcome: function() {
        this._$row.find('.p-value, .improvement').html('&mdash;');
    },

    renderConversionRange: function(range, baselineRange, overallRange) {
        if (!this._supportsSvg(document)) {
            return;
        }

        var canvas = this._$row.find('.conversion-visual');
        var width = 200;
        var height = 15;
        var scale = pv.Scale
            .linear(overallRange.lowerBound, overallRange.upperBound)
            .range(0, width);
        var colors = pv.colors(
            Abba.RESULT_COLORS.neutral,
            Abba.RESULT_COLORS.lose,
            Abba.RESULT_COLORS.win
        );

        var panel = new pv.Panel()
            .width(width)
            .height(height)
            .left(10)
            .right(10)
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
            .left(function(data) { var l = scale(data); return (this.index === 0) ? l - 1 : l; })
            .top(height / 2 - endMarkHeight / 2)
            .height(endMarkHeight)
            .strokeStyle('#444')
            .anchor(function() { return (this.index === 0) ? 'left' : 'right'; })
            .add(pv.Label)
            .font('12px "Arial"')
            .textStyle('#444')
            .textBaseline('middle')
            .text(function() { return (this.index === 0) ? '-' : '+'; });

        // Center line
        panel.add(pv.Rule)
            .left(0)
            .top(height / 2)
            .width(width)
            .strokeStyle('#444');

        panel.render();
    }
};

// Handles all DOM manipulation and event binding
Abba.ResultsView = function($container) {
    this._$container = $container;
    this._formatter = new Abba.Formatter();

    $container.html(Abba.RESULT_TABLE_HTML);
    $container.hide();
}
Abba.ResultsView.prototype = {
    addResultRow: function(label) {
        this._$container.show();

        var $resultTable = this._$container.find('.result-table');
        $resultTable.append(Abba.RESULT_ROW_HTML);
        var $resultRow = $resultTable.children().last();
        $resultRow.find('.bucket-name').text(label);
        return new Abba.ResultRowView($resultRow, this._formatter);
    },

    clearResults: function() {
        this._$container.find('.result-row').remove();
        this._$container.hide();
    }
};

Abba.ExperimentOptions = function(intervalAlpha, useMultipleTestCorrection) {
    this.intervalAlpha = intervalAlpha;
    this.useMultipleTestCorrection = useMultipleTestCorrection;
}
Abba.ExperimentOptions.defaults = function() {
    return new Abba.ExperimentOptions(Abba.DEFAULT_INTERVAL_ALPHA, true);
}

Abba.ResultsPresenter = function(experimentClass) {
    this._view = undefined;
    this._experimentClass = experimentClass;
}
Abba.ResultsPresenter.prototype = {
    bind: function(view) {
        this._view = view;
    },

    makeExperiment: function(baseline, variations, options) {
        if (options === undefined) {
            options = Abba.ExperimentOptions.defaults();
        }
        return new this._experimentClass(
            options.useMultipleTestCorrection ? variations.length : 1,
            baseline.numSuccesses,
            baseline.numTrials,
            options.intervalAlpha
                ? options.intervalAlpha
                : Abba.DEFAULT_INTERVAL_CONFIDENCE_LEVEL
        );
    },

    _computeResults: function(baseline, variations, options) {
        var experiment = this.makeExperiment(baseline, variations, options);
        var baselineProportion = experiment.getBaselineProportion();
        var overallConversionBounds = {lowerBound: baselineProportion.lowerBound,
                                       upperBound: baselineProportion.upperBound};
        var variations = variations.map(function(variation) {
            var outcome = experiment.getResults(variation.numSuccesses, variation.numTrials);
            overallConversionBounds.lowerBound = Math.min(overallConversionBounds.lowerBound,
                                                          outcome.proportion.lowerBound)
            overallConversionBounds.upperBound = Math.max(overallConversionBounds.upperBound,
                                                          outcome.proportion.upperBound)
            return {inputs: variation, outcome: outcome};
        });

        return {
            baselineProportion: baselineProportion,
            overallConversionBounds: overallConversionBounds,
            variations: variations
        };
    },

    computeAndDisplayResults: function(allInputs, options) {
        this._view.clearResults();
        var results = this._computeResults(allInputs.baseline, allInputs.variations, options);

        var renderConversionWithRange = function(resultRow, inputs, proportion) {
            resultRow.renderConversion(inputs.numSuccesses, inputs.numTrials, proportion)
            resultRow.renderConversionRange(proportion,
                                            results.baselineProportion,
                                            results.overallConversionBounds);
        };

        var baselineResultRow = this._view.addResultRow(allInputs.baseline.label);
        renderConversionWithRange(baselineResultRow,
                                  allInputs.baseline,
                                  results.baselineProportion);
        baselineResultRow.blankOutcome();

        var self = this;
        results.variations.forEach(function(variation_results) {
            var resultRow = self._view.addResultRow(variation_results.inputs.label);
            renderConversionWithRange(resultRow,
                                      variation_results.inputs,
                                      variation_results.outcome.proportion);
            resultRow.renderOutcome(variation_results.outcome.pValue,
                                    variation_results.outcome.relativeImprovement);
        });
    }
};

Abba.Abba = function(baselineName, baselineNumSuccesses, baselineNumTrials) {
    this._baseline = {
        label: baselineName,
        numSuccesses: baselineNumSuccesses,
        numTrials: baselineNumTrials
    };
    this._variations = [];
    this._options = Abba.ExperimentOptions.defaults();
    this._presenter = new Abba.ResultsPresenter(Abba.Experiment);
}
Abba.Abba.prototype = {
    setIntervalAlpha: function(alpha) {
        this._options.intervalAlpha = alpha;
    },

    setMultipleTestCorrectionEnabled: function(isEnabled) {
        this._options.useMultipleTestCorrection = isEnabled;
    },

    addVariation: function(label, numSuccesses, numTrials) {
        this._variations.push({label: label, numSuccesses: numSuccesses, numTrials: numTrials});
    },

    renderTo: function(container) {
        this._presenter.bind(new Abba.ResultsView($(container)));
        this._presenter.computeAndDisplayResults(
            {baseline: this._baseline, variations: this._variations},
            this._options
        );
    },

    getResults: function() {
        var experiment = this._presenter.makeExperiment(
            this._baseline,
            this._variations,
            this._options
        );
        var results = {}
        results[this._baseline.label] = experiment.getBaselineProportion();
        this._variations.forEach(function(variation) {
            results[variation.label] = experiment.getResults(variation.numSuccesses,
                                                             variation.numTrials);
        });
        return results;
    }
};

return Abba;
}(Abba || {}, jQuery, pv));
