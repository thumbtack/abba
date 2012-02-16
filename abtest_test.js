describe('NormalDistribution', function() {
    var normal = new NormalDistribution();

    beforeEach(function() {
        this.addMatchers({
            // like toBeCloseTo(), but looks at absolute error rather than rounding to some precision
            toBeNear: function(expected, max_error) {
                return Math.abs(this.actual - expected) < max_error;
            },
        });
    });

    it('computes CDFs and survival functions', function() {
        var MAX_ERROR = 7.5e-8;

        var expected_cumulative_probabilities = {};
        expected_cumulative_probabilities[0] = 0.5;
        expected_cumulative_probabilities[1] = 0.84134474606854293;
        expected_cumulative_probabilities[2] = 0.97724986805182079;
        expected_cumulative_probabilities[-1] = 1 - expected_cumulative_probabilities[1];

        for (var z_value in expected_cumulative_probabilities) {
            expect(normal.cdf(z_value))
                .toBeNear(expected_cumulative_probabilities[z_value], MAX_ERROR);
            expect(normal.survival(z_value))
                .toBeNear(1 - expected_cumulative_probabilities[z_value], MAX_ERROR);
        }
    });

    it('computes inverse CDFs and survival functions', function() {
        var MAX_ERROR = 4.5e-4;

        var expected_z_values = {};
        expected_z_values[0.5] = 0;
        expected_z_values[0.75] = 0.67448975019608171;
        expected_z_values[0.95] = 1.6448536269514729;
        expected_z_values[0.05] = -expected_z_values[0.95];

        for (var probability in expected_z_values) {
            expect(normal.inverse_cdf(probability))
                .toBeNear(expected_z_values[probability], MAX_ERROR);
            expect(normal.inverse_survival(probability))
                .toBeNear(-expected_z_values[probability], MAX_ERROR);
        }
    });
});

describe('Experiment', function() {
    var experiment = new Experiment(3, 20, 1000, 0.05);

    it('computes the baseline proportion', function() {
        var proportion = experiment.get_baseline_proportion();
        expect(proportion.value).toBe(0.02);
        expect(proportion.interval_width).toBeCloseTo(0.0074957);
        expect(proportion.range().lower_bound).toBeCloseTo(0.0125043);
        expect(proportion.range().upper_bound).toBeCloseTo(0.0274957);
    });

    it('computes experiment results', function() {
        var results = experiment.get_results(50, 2000);
        expect(results.proportion.value).toBeCloseTo(0.025);
        expect(results.proportion.interval_width).toBeCloseTo(0.0059097);
        expect(results.relative_improvement.value).toBeCloseTo(0.25);
        expect(results.relative_improvement.interval_width).toBeCloseTo(0.6748677);
        expect(results.p_value).toBeCloseTo(0.4838344);
    });
});

describe('Formatter', function() {
    var formatter = new Formatter();

    it('formats numbers', function() {
        expect(formatter.describe_number(1234567.89012, 2)).toBe('1,234,567.89');
    });

    it('formats percents', function() {
        expect(formatter.percent(0.123456)).toBe('12%');
        expect(formatter.percent(0.0123456)).toBe('1.2%');
        expect(formatter.percent(0.00123456)).toBe('0.12%');
    });
});

describe('Presenter', function() {
    var experiment_params;
    var StubExperiment = function(num_trials,
                                  baseline_num_successes,
                                  baseline_num_samples,
                                  base_alpha) {
        experiment_params.num_trials = num_trials;
        experiment_params.baseline_num_successes = baseline_num_successes;
        experiment_params.baseline_num_samples = baseline_num_samples;
        experiment_params.trial_data = [];

        this.get_baseline_proportion = function() {
            return new ValueWithInterval(0.5, 0.2);
        };

        this.get_results = function(num_successes, num_samples) {
            experiment_params.trial_data.push([num_successes, num_samples]);
            return {
                proportion: new ValueWithInterval(0.6, 0.3),
                relative_improvement: new ValueWithInterval(1.2, 0.15),
                p_value: 0.123,
            };
        };
    };

    var FakeView = function() {
        this.add_trial_callback = undefined;
        this.compute_callback = undefined;
        this.history_callback = undefined;
        this.history_hash = undefined;
        this.added_inputs = [];
        this.inputs_that_were_set = undefined;
        this.has_been_cleared = false;
        this.result_rows = [];

        this.set_add_trial_handler = function(callback) {
            this.add_trial_callback = callback;
        };

        this.set_compute_handler = function(callback) {
            this.compute_callback = callback;
        };

        this.set_history_handler = function(callback) {
            this.history_callback = callback;
        },

        this.go_to_hash = function(hash) {
            this.history_hash = hash;
            this.history_callback(hash);
        },

        this.add_input_row = function(name) {
            this.added_inputs.push(name);
        };

        this.get_inputs = function() {
            return {
                baseline: {
                    label: 'Baseline',
                    num_successes: 10,
                    num_samples: 20,
                },
                trials: [{
                    label: 'Trial 1',
                    num_successes: 60,
                    num_samples: 100,
                }],
            };
        };

        this.set_inputs = function(inputs) {
            this.inputs_that_were_set = inputs;
        };

        this.add_result_row = function(label) {
            var row = {
                render_conversion: function(num_successes, num_samples, rate) {
                    this.num_successes = num_successes;
                    this.num_samples = num_samples;
                    this.rate = rate;
                },

                render_outcome: function(p_value, improvement) {
                    this.p_value = p_value;
                    this.improvement = improvement;
                },

                blank_outcome: function() {
                    this.is_blank_outcome = true;
                },

                render_conversion_range: function(range, baseline_range, overall_range) {
                    this.range = range;
                    this.baseline_range = baseline_range;
                    this.overall_range = overall_range;
                },
            };
            this.result_rows.push({label: label, row: row});
            return row;
        };

        this.clear_results = function() {
            this.has_been_cleared = true;
        };
    };

    var view = undefined;
    var presenter = new Presenter(StubExperiment);

    beforeEach(function() {
        experiment_params = {};
        view = new FakeView();
        presenter.bind(view);
    });

    it('adds trials', function() {
        view.add_trial_callback();
        expect(view.added_inputs).toEqual(['Trial 2']);
    });

    it('computes results', function() {
        view.compute_callback();

        expect(experiment_params.num_trials).toBe(1);
        expect(experiment_params.baseline_num_successes).toBe(10);
        expect(experiment_params.baseline_num_samples).toBe(20);
        expect(experiment_params.trial_data).toEqual([[60, 100]]);

        expect(view.result_rows.length).toBe(2);

        var baseline_row = view.result_rows[0];
        expect(baseline_row.label).toBe('Baseline');
        expect(baseline_row.row.num_successes).toBe(10);
        expect(baseline_row.row.num_samples).toBe(20);
        expect(baseline_row.row.rate.value).toBe(0.5);
        expect(baseline_row.row.rate.interval_width).toBe(0.2);
        expect(baseline_row.row.is_blank_outcome).toBeTruthy();
        expect(baseline_row.row.range.lower_bound).toBeCloseTo(0.3);
        expect(baseline_row.row.range.upper_bound).toBeCloseTo(0.7);
        expect(baseline_row.row.overall_range.lower_bound).toBeCloseTo(0.3);
        expect(baseline_row.row.overall_range.upper_bound).toBeCloseTo(0.9);

        var trial_row = view.result_rows[1];
        expect(trial_row.label).toBe('Trial 1');
        expect(trial_row.row.num_successes).toBe(60);
        expect(trial_row.row.num_samples).toBe(100);
        expect(trial_row.row.rate.value).toBe(0.6);
        expect(trial_row.row.rate.interval_width).toBe(0.3);
        expect(trial_row.row.p_value).toBe(0.123);
        expect(trial_row.row.improvement.value).toBe(1.2);
        expect(trial_row.row.improvement.interval_width).toBe(0.15);
        expect(trial_row.row.baseline_range.lower_bound).toBeCloseTo(0.3);
        expect(trial_row.row.baseline_range.upper_bound).toBeCloseTo(0.7);
    });

    it('handles history', function() {
        view.compute_callback();
        var old_view = view;

        // "Reload" the app
        view = new FakeView();
        presenter = new Presenter(StubExperiment);
        presenter.bind(view);

        view.history_callback(old_view.history_hash);
        expect(view.inputs_that_were_set).toEqual(old_view.get_inputs());
    });
});