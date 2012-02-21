$(function() {
    var presenter = new Presenter(ABTest);
    presenter.bind(
        new InputsView($('#inputs'), document.getElementById('hidden-iframe')),
        $('#results')
    );
});
