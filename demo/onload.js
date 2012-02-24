$(function() {
    var presenter = new Abba.Presenter(Abba.Abba);
    presenter.bind(
        new Abba.InputsView($('#inputs'), document.getElementById('hidden-iframe')),
        $('#results')
    );
});
