var path = require('path');
var yesno = require('yesno');
var Promise = require("bluebird");
var MeterBox = require('meterbox');
var Pogoplug = require('pogoplug-api');
var recursive = require('recursive-readdir');
var UploadItem = require('./lib/uploadItem');
var EventEmitter = require('events').EventEmitter;

require('util').print("\u001b[2J\u001b[0;0H");

var fromPath = process.argv[2] || '/path/to/local';
var toPath = process.argv[3] || '/path/to/remote';

//TODO: validation

/*==============*/
/* Upload Files */
/*==============*/
var recursiveAsync = Promise.promisify(recursive);
var client = Promise.promisifyAll(new Pogoplug('./data/token.json'));

var NEED_CONFIRM = true;
var MULTI_JOB_MAX = 10;

var uploadList = [];

Promise.resolve().then(function() {
    // fromPathからファイルをリストアップ
    return recursiveAsync(fromPath, ['.DS_Store']);
}).then(function(files) {
    // fromPath, toPathの情報を整理
    uploadList = files.map(function(filepath) {
        var parsedPath = path.parse(filepath);
        return {
            fromPath: filepath,
            toPath: path.join(toPath, parsedPath.dir.replace(fromPath.replace(/\/$/, ''), ''))
        };
    });
    return uploadList;
}).then(function() {
    // アップロードするファイルを確認
    if (NEED_CONFIRM) {
        console.log('upload targets:');
        var prevPath = '';
        uploadList.forEach(function(uploadData) {
            if (prevPath != uploadData.toPath) {
                prevPath = uploadData.toPath;
                console.log('\tto ---> ' + prevPath);
            }
            console.log('\t\tfrom: ' + uploadData.fromPath);
        });
        return new Promise(function(resolve, reject) {
            yesno.ask('Are you sure you want to continue? (yes)', true, function(ok) {
                resolve(ok);
            });
        });
    } else {
        return true;
    }
}).then(function(answer) {
    if (!answer) {
        console.log('abort');
        process.exit(1);
        return;
    }

    // toPathをリストアップ
    var dirs = uploadList.reduce(function(dirs, upload) {
        if (dirs.every(function(a) { return (a !== upload.toPath); })) {
            dirs.push(upload.toPath);
        }
        return dirs;
    }, []).sort();

    // toPathを全て作成
    console.log('Make parent dirs...');

    var promiseChain = Promise.resolve();
    dirs.forEach(function(dir) {
        promiseChain = promiseChain.then(function() {
            console.log('\t' + dir);
            return client.mkdirAsync(dir);
        });
    });
    return promiseChain;
}).then(function() {

    var meterBox = new MeterBox({
        name: 'pogockup progress',
        multijob: MULTI_JOB_MAX,
        barWidth: 50
    });

    var count = 0;
    var uploadItemList = uploadList.map(function(data) {
        var item = new UploadItem(client, data.fromPath, data.toPath);

        var label = '[' + count++ + '] ' + path.parse(data.fromPath).base;

        var meterBoxParam = {
            fromPath: data.fromPath,
            toPath: data.toPath,
            label: label.substring(0, 30)
        };

        meterBox.add(meterBoxParam, function(meter, done) {
            item.start(meter, done);
        });

        return item;
    });

    meterBox.run();
});
