var prettyjson = require('prettyjson');

module.exports = function makeErrorMessage(err) {
    var json = prettyjson.render(err, {noColor: true});
    json = json.split('\n').join('\n    ');
    var metadata = '    ' + json;
    var stack = err.stack.trim();
    return stack + '\n  Metadata:\n' + metadata;
}
