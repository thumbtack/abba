$(function() {
    var presenter = new ABTest.Presenter(ABTest.ABTest);
    presenter.bind(
        new ABTest.InputsView($('#inputs'), document.getElementById('hidden-iframe')),
        $('#results')
    );
});
