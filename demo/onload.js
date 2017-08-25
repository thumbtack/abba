// Copyright (c) 2012 Thumbtack, Inc.

$(function() {
    // override default result colors for charts
    Abba.RESULT_COLORS = {
        neutral: '#B8B8B8',
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
