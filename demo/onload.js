$(function() {
    // override default result colors for charts
    Abba.RESULT_COLORS = {
        neutral: '#D8D8D8',
        lose: '#B42647',
        win: '#26B43C'
    };

    var presenter = new Abba.Presenter(Abba.Abba);
    presenter.bind(
        new Abba.InputsView($('.inputs'), document.getElementById('hidden-iframe')),
        $('.results')
    );

    // trigger animations
    $("h1").addClass("animate");
});
