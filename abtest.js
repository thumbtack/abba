/* Polynomial and rational approximations to standard normal probability functions. From:

   Abramowitz, Milton; Stegun, Irene A., eds. (1972), Handbook of Mathematical Functions with
   Formulas, Graphs, and Mathematical Tables, New York: Dover Publications, ISBN 978-0-486-61272-0

   Available online at http://people.math.sfu.ca/~cbm/aands/
*/
function NormalDistribution() {}
NormalDistribution.prototype = {
    density: function(z_value) {
        return 1 / Math.sqrt(2 * Math.PI) * Math.exp(-z_value * z_value / 2);
    },

    // Returns P(x < z_value) for x standard normal. z_value may be any number.
    cdf: function(z_value) {
        // Formula 26.2.17, http://people.math.sfu.ca/~cbm/aands/page_932.htm
        // Valid for z_value >= 0, abs(error) < 7.5 x 10^-8
        var p = 0.2316419;
        var b1 = 0.319381530;
        var b2 = -0.356563782;
        var b3 = 1.781477937;
        var b4 = -1.821255978;
        var b5 = 1.330274429;

        var is_inverted = false;
        if (z_value < 0) {
            z_value = -z_value;
            is_inverted = true;
        }

        var t = 1 / (1 + p * z_value);
        var density = this.density(z_value);
        var probability = 1 - density * t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
        if (is_inverted) {
            probability = 1 - probability;
        }
        return probability;
    },

    // Returns P(x > z_value) for x standard normal. z_value may be any number.
    survival: function(z_value) {
        return 1 - this.cdf(z_value);
    },

    // Returns z such that P(x > z) = probability for x standard normal.
    // probability must be in (0, 1).
    inverse_survival: function(probability) {
        // Formula 26.2.23, http://people.math.sfu.ca/~cbm/aands/page_933.htm
        // Valid for 0 < probability <= 0.5, abs(error) < 4.5 x 10^-4
        var c0 = 2.515517;
        var c1 = 0.802853;
        var c2 = 0.010328;
        var d1 = 1.432788;
        var d2 = 0.189269;
        var d3 = 0.001308;

        var multiplier = 1;
        if (probability > 0.5) {
            probability = 1 - probability;
            multiplier = -1;
        }

        var t = Math.sqrt(
            Math.log(1 / (probability * probability))
        );
        var z_estimate = t - (c0 + t * (c1 + t * c2)) / (1 + t * (d1 + t * (d2 + t * d3)));
        return z_estimate * multiplier;
    },

    // Returns z such that P(x < z) = probability for x standard normal.
    // probability must be in (0, 1).
    inverse_cdf: function(probability) {
        return -this.inverse_survival(probability);
    },
};

function ValueWithInterval(value, interval_width) {
    this.value = value;
    this.interval_width = interval_width;
}
ValueWithInterval.prototype = {
    range: function() {
        return {
            lower_bound: this.value - this.interval_width,
            upper_bound: this.value + this.interval_width
        };
    },
};

// A value with standard error, from which a confidence interval can be derived.
function ValueWithError(value, error) {
    this.value = value;
    this.error = error;
}
ValueWithError.prototype = {
    /* critical_z_value should be the value at which the right-tail probability for a standard
       normal distribution equals half the desired alpha = 1 - confidence level:

       P(Z > z_value) = 1 - alpha / 2

       where Z is an N(0, 1) random variable.  Use NormalDistribution.inverse_survival(), or see
       http://en.wikipedia.org/wiki/Standard_normal_table.
    */
    confidence_interval_width: function(critical_z_value) {
        return critical_z_value * this.error;
    },

    value_with_interval: function(critical_z_value) {
        return new ValueWithInterval(this.value, this.confidence_interval_width(critical_z_value));
    },
};

// Represents a binomial proportion with num_successes successful samples out of num_samples total.
function Proportion(num_successes, num_samples) {
    this.num_successes = num_successes;
    this.num_samples = num_samples;
}
Proportion.prototype = {
    /* Generate an estimate for the underlying probability of success using the maximum likelihood
       estimator and the normal approximation error.
    */
    p_estimate: function() {
        var p_estimate = 1.0 * this.num_successes / this.num_samples;
        var standard_error = Math.sqrt(p_estimate * (1 - p_estimate) / this.num_samples);
        return new ValueWithError(p_estimate, standard_error);
    },
};

function ProportionComparison(baseline, trial) {
    this.baseline = baseline;
    this.trial = trial;
    this._normal = new NormalDistribution();
}
ProportionComparison.prototype = {
    // Generate an estimate of the difference in success rates between the trial and the baseline.
    difference_estimate: function() {
        var baseline_p = this.baseline.p_estimate();
        var trial_p = this.trial.p_estimate();
        var difference = trial_p.value - baseline_p.value;
        var standard_error = Math.sqrt(Math.pow(baseline_p.error, 2) + Math.pow(trial_p.error, 2));
        return new ValueWithError(difference, standard_error);
    },

    // Return the difference in sucess rates as a proportion of the baseline success rate.
    difference_ratio: function() {
        var baseline_value = this.baseline.p_estimate().value;
        var ratio = this.difference_estimate().value / baseline_value;
        var error = this.difference_estimate().error / baseline_value;
        return new ValueWithError(ratio, error);
    },

    /* Perform a large-sample z-test of null hypothesis H0: p_baseline == p_trial against
       alternative hypothesis H1: p_baseline < p_trial.  Return the (one-tailed) p-value.

       z_multiplier: test z-value will be multiplied by this factor before computing a p-value.

       See http://en.wikipedia.org/wiki/Statistical_hypothesis_testing#Common_test_statistics,
       "Two-proportion z-test, pooled for d0 = 0".
    */
    z_test: function(z_multiplier) {
        var pooled_stats = new Proportion(this.baseline.num_successes + this.trial.num_successes,
                                          this.baseline.num_samples + this.trial.num_samples);
        var pooled_p_value = pooled_stats.p_estimate().value;
        var pooled_variance_of_difference = (
                pooled_p_value * (1 - pooled_p_value)
                * (1.0 / this.baseline.num_samples + 1.0 / this.trial.num_samples));
        var pooled_standard_error_of_difference = Math.sqrt(pooled_variance_of_difference);
        var test_z_value = this.difference_estimate().value / pooled_standard_error_of_difference;
        var adjusted_one_tailed_p_value = this._normal.survival(
            Math.abs(test_z_value * z_multiplier));
        return 2 * adjusted_one_tailed_p_value;
    },
};

// num_trials: number of trials to be compared to the baseline (i.e., not including the baseline)
function Experiment(num_trials, baseline_num_successes, baseline_num_samples, base_alpha) {
    this._normal = new NormalDistribution();
    this._baseline = new Proportion(baseline_num_successes, baseline_num_samples);

    num_comparisons = Math.max(1, num_trials);
    // all z-values are two-tailed
    var base_z_critical_value = this._normal.inverse_survival(base_alpha / 2);
    var alpha = base_alpha / num_comparisons // Bonferroni correction
    this._z_critical_value = this._normal.inverse_survival(alpha / 2);
    // to normalize for multiple testing, rather than scaling the hypothesis test's p-value, we
    // scale the z-value by this amount
    this._z_multiplier = base_z_critical_value / this._z_critical_value;
    // z critical value for confidence interval on individual proportions
    this._trial_interval_z_critical_value = this._z_critical_value / Math.sqrt(2)
}
Experiment.prototype = {
    get_baseline_proportion: function() {
        return this._baseline.p_estimate().value_with_interval(
            this._trial_interval_z_critical_value);
    },

    get_results: function(num_successes, num_samples) {
        var trial = new Proportion(num_successes, num_samples);
        var comparison = new ProportionComparison(this._baseline, trial);
        return {
            proportion: trial.p_estimate().value_with_interval(
                this._trial_interval_z_critical_value),
            relative_improvement: comparison.difference_ratio().value_with_interval(
                this._z_critical_value),
            p_value: comparison.z_test(this._z_multiplier)
        };
    },
};

function Formatter() {}
Formatter.prototype = {
    describe_number: function(number, decimal_spots) {
        if (!decimal_spots) {
            if (number % 1 == 0) {
                decimal_spots = 0;
            } else {
                decimal_spots = 1;
            }
        }

        var number_string = String(number.toFixed(decimal_spots));
        var parts = number_string.split('.');
        var whole = parts[0];

        var pattern = /(\d+)(\d{3})(,|$)/;
        while (pattern.test(whole)) {
            whole = whole.replace(pattern, '$1,$2');
        }

        number_string = (parts.length > 1) ? whole + '.' + parts[1] : whole;
        return number_string;
    },

    _round: function(value, places) {
        var factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    },

    _get_default_places: function(ratio) {
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
            places = this._get_default_places(ratio);
        }
        return this._round(100 * ratio, places) + '%';
    },
}

function ResultRowView(row, formatter) {
    this._row = row;
    this._formatter = formatter;
}
ResultRowView.prototype = {
    _render_interval: function(value_with_interval, container) {
        container
            .find('.base').text(this._formatter.percent(value_with_interval.value)).end()
            .find('.error > span').text(this._formatter.percent(value_with_interval.interval_width));
    },

    render_conversion: function(num_successes, num_samples, rate) {
        this._row
            .find('.yes').text(this._formatter.describe_number(num_successes)).end()
            .find('.total').text(this._formatter.describe_number(num_samples));
        this._render_interval(rate, this._row.find('.conversion-numeric'));
    },

    render_outcome: function(p_value, improvement) {
        var p_value_text = this._formatter.percent(p_value);
        if (p_value_text == '0%') {
            p_value_text = '< 0.01%';
        }
        this._row.find('.p-value').text(p_value_text);
        this._render_interval(improvement, this._row.find('.improvement'));
    },

    blank_outcome: function() {
        this._row.find('.p-value, .improvement').html('&mdash;');
    },

    render_conversion_range: function(range, baseline_range, overall_range) {
        var canvas = this._row.find('.conversion-visual');
        var width = 200;
        var height = 25;
        var scale = pv.Scale
            .linear(overall_range.lower_bound, overall_range.upper_bound)
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
                lower_bound: range.lower_bound,
                upper_bound: Math.min(range.upper_bound, baseline_range.lower_bound)
            },
            {
                lower_bound: Math.max(range.lower_bound, baseline_range.upper_bound),
                upper_bound: range.upper_bound
            }
        ];

        // Range indicators
        panel.add(pv.Bar)
            .data(ranges)
            .top(0)
            .height(height)
            .left(function(data) { return scale(data.lower_bound); })
            .width(function(data) { return scale(data.upper_bound) - scale(data.lower_bound); })
            .fillStyle(colors.by(function() { return this.index; }));

        // End marks
        var end_mark_height = 7;
        panel.add(pv.Rule)
            .data([overall_range.lower_bound, overall_range.upper_bound])
            .visible(function(data) { return data; })
            .left(function(data) { var l = scale(data); return (this.index == 0) ? l - 1 : l; })
            .top(height / 2 - end_mark_height / 2)
            .height(end_mark_height)
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
function View() {
    this._formatter = new Formatter();
}
View.prototype = {
    set_add_trial_handler: function(callback) {
        $('#add-input-link').click(function(event) {
            event.preventDefault()
            callback();
        });
    },

    set_compute_handler: function(callback) {
        $('#inputs').submit(function(event) {
            event.preventDefault();
            callback();
        });
    },

    set_history_handler: function(callback) {
        Hash.init(callback, document.getElementById('hidden-iframe'));
    },

    go_to_hash: function(hash) {
        Hash.go(hash);
    },

    _create_input_row: function() {
        var row = $('#baseline-input-row')
            .clone()
            .removeAttr('id')
            .find('input').val('').end()
            .appendTo('#inputs-table');
        row.find('.remove-input-link')
            .show()
            .click(function(event) {
                event.preventDefault();
                row.remove();
            });
        return row;
    },

    _read_input_row: function(row) {
        return {
            label: row.find('.label-input').val(),
            num_successes: parseInt(row.find('.num-successes-input').val()),
            num_samples: parseInt(row.find('.num-samples-input').val()),
        };
    },

    _write_input_row: function(row, values) {
        row.find('.label-input').val(values.label).end()
            .find('.num-successes-input').val(values.num_successes).end()
            .find('.num-samples-input').val(values.num_samples);
    },

    add_input_row: function(name) {
        var row = this._create_input_row();
        row.find('.label-input').val(name);
    },

    _trial_input_rows: function() {
        return $('.input-row').not('#baseline-input-row');
    },

    get_inputs: function() {
        var self = this;
        return {
            baseline: this._read_input_row($('#baseline-input-row')),
            trials: this._trial_input_rows()
                .map(function() {
                    return self._read_input_row($(this));
                })
                .get(),
        };
    },

    set_inputs: function(inputs) {
        var self = this;
        self._write_input_row($('#baseline-input-row'), inputs.baseline);

        this._trial_input_rows().remove();
        $(inputs.trials).each(function() {
            self._write_input_row(self._create_input_row(), this);
        });
    },

    add_result_row: function(label) {
        $('#results').show();

        var result_row = $('#result-row-template')
            .clone()
            .removeAttr('id')
            .addClass('result-row')
            .show()
            .find('.bucket-name').text(label).end()
            .appendTo('#result-table');
        return new ResultRowView(result_row, this._formatter);
    },

    clear_results: function() {
        $('.result-row').remove();
        $('#results').hide();
    },
}

function Presenter(experiment_class) {
    this._view = undefined;
    this._experiment_class = experiment_class;
}
Presenter.prototype = {
    bind: function(view) {
        this._view = view;
        var self = this;
        view.set_add_trial_handler(function() { self._add_trial(); });
        view.set_compute_handler(function() { self._trigger_computation(); });
        view.set_history_handler(function(hash) { self._handle_history_change(hash); });
    },

    _choose_trial_name: function() {
        var inputs = this._view.get_inputs();
        var used_names = {};
        used_names[inputs.baseline.label] = true;
        $(inputs.trials).each(function() {
            used_names[this.label] = true;
        });

        var index = 1;
        while (true) {
            var label = 'Trial ' + index;
            if (!(label in used_names)) {
                return label;
            }
            index++;
        }
    },

    _add_trial: function() {
        this._view.add_input_row(this._choose_trial_name());
    },

    _serialize_inputs: function(inputs) {
        var data = {};
        function add_row(row_data) {
            data[row_data.label] = row_data.num_successes + ',' + row_data.num_samples;
        }
        add_row(inputs.baseline);
        $(inputs.trials).each(function() { add_row(this); });
        return $.param(data);
    },

    _deserialize_inputs: function(hash) {
        var trials = [];
        $(hash.split('&')).each(function() {
            var parts = $(this.split('=')).map(function() {
                return decodeURIComponent(this.replace('+', ' '));
            });
            var value_parts = $(parts[1].split(',')).map(function() { return parseInt(this); });
            trials.push({
                label: parts[0],
                num_successes: value_parts[0],
                num_samples: value_parts[1]
            });
        });

        var baseline = trials.shift();
        return {
            baseline: baseline,
            trials: trials,
        };
    },

    _trigger_computation: function() {
        this._view.go_to_hash(this._serialize_inputs(this._view.get_inputs()));
    },

    _handle_history_change: function(hash) {
        this._view.clear_results();
        if (hash) {
            this._view.set_inputs(this._deserialize_inputs(hash));
            this._compute_and_display_results();
        } else {
            this._view.set_inputs({
                baseline: {label: 'Baseline'},
                trials: [{label: 'Trial 1'}],
            });
        }
    },

    _compute_results: function(all_inputs) {
        var experiment = new this._experiment_class(all_inputs.trials.length,
                                                    all_inputs.baseline.num_successes,
                                                    all_inputs.baseline.num_samples,
                                                    0.05); // TODO

        var baseline_proportion = experiment.get_baseline_proportion();
        var overall_conversion_bounds = {lower_bound: baseline_proportion.range().lower_bound,
                                         upper_bound: baseline_proportion.range().upper_bound};
        var trials = $(all_inputs.trials).map(function() {
            var outcome = experiment.get_results(this.num_successes, this.num_samples);
            overall_conversion_bounds.lower_bound = Math.min(overall_conversion_bounds.lower_bound,
                                                             outcome.proportion.range().lower_bound)
            overall_conversion_bounds.upper_bound = Math.max(overall_conversion_bounds.upper_bound,
                                                             outcome.proportion.range().upper_bound)
            return {inputs: this, outcome: outcome};
        });

        return {
            baseline_proportion: baseline_proportion,
            overall_conversion_bounds: overall_conversion_bounds,
            trials: trials
        };
    },

    _compute_and_display_results: function() {
        var all_inputs = this._view.get_inputs();
        var results = this._compute_results(all_inputs);

        var render_conversion_with_range = function(result_row, inputs, proportion) {
            result_row.render_conversion(inputs.num_successes, inputs.num_samples, proportion)
            result_row.render_conversion_range(proportion.range(),
                                               results.baseline_proportion.range(),
                                               results.overall_conversion_bounds);
        };

        var baseline_result_row = this._view.add_result_row(all_inputs.baseline.label);
        render_conversion_with_range(baseline_result_row,
                                     all_inputs.baseline,
                                     results.baseline_proportion);
        baseline_result_row.blank_outcome();

        var self = this;
        results.trials.each(function() {
            var result_row = self._view.add_result_row(this.inputs.label);
            render_conversion_with_range(result_row, this.inputs, this.outcome.proportion);
            result_row.render_outcome(this.outcome.p_value, this.outcome.relative_improvement)
        });
    },
};
