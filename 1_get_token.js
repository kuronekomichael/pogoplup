var Pogoplug = require('pogoplug-api');
var path = require('path');
var fs = require('fs');
var prompt = require('prompt');
'use strict';

require('util').print("\u001b[2J\u001b[0;0H");

var client = new Pogoplug();

console.log('input your Pogoplug account:');
prompt.start({ message: '>' });
prompt.get(
    [
        { name: 'username', required: true },
        { name: 'password', required: true, hidden: true }
    ], function (err, result) {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        /*===========*/
        /* Get Token */
        /*===========*/
        client.login(result.username, result.password,  function(err, token) {
            if (err) {
                console.error('Error', err);
                return;
            }
            console.log("Login Succeeded!: \n", client);

            var savePath = './data/token.json';
            var dir = path.parse(savePath).dir;

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }

            fs.writeFileSync(savePath, JSON.stringify(client));
            console.log('saved to ' + savePath);
        });
});

return;
