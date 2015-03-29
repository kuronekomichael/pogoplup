var sinon = require('sinon');// for test

sinon.stub(client, 'mkdirAsync', function() {
    return new Promise(function(resolve) {
        setTimeout(function() {
            resolve();
        }, 1);
    });
});

sinon.stub(client, 'upload', function(fromPath, toPath) {

    var isError = /cat-98359_1920/.test(fromPath);

    var ev = new EventEmitter();
    var counter = 0;
    var delta = (fromPath.length % 10) + 1;
    var timer = setInterval(function() {

        if (isError && counter > 52) {
            clearInterval(timer);
            ev.emit('error', new Error('てきとう'));
            ev.emit('data', delta + 1, 100);
            ev.emit('end');
            return;
        }

        counter += delta;
        if (counter > 100) counter = 100;
        ev.emit('data', delta, 100);
        if (counter === 100) {
            clearInterval(timer);
            ev.emit('end');
        }
    }, 20);
    return ev;
});
