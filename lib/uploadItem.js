'use strict';
var fs = require('fs');
var path = require('path');
var moment = require("moment");
var pretty = require('prettysize');
var makeErrorMessage = require('../lib/make-error-message');

var RETRY_MAX = 99;// 0 => no retry
var ENABLE_LOGFILE = true;
var LAP_MAX = 100;

function UploadItem(client, fromPath, toPath) {
    this.client = client;
    this.fromPath = fromPath;
    this.toPath = toPath;
    this.retryCount = 0;
    this.logs = [];

    this.init();
}

UploadItem.prototype.init = function() {
    var now = new Date().getTime();
    this.lapTimer = {
        startTime: now,
        prevTime: now,
        laps: []/* {size: send byte, msec: spend time} */
    };
    this.percent = 0;
    this.size = 0;
    this.totalSize = -1;
    this.raiseError = false;
    this.canRetry = false;
};

UploadItem.prototype.start = function(meter, done) {
    var that = this;
    that.meter = meter;
    that.done = done;

    that.client
    .upload(that.fromPath, that.toPath)
    .on('data', function(size, totalSize) {
        that.onData(size, totalSize);
    })
    .on('error', function(err) {
        that.onError(err);
    })
    .on('end', function() {
        that.onEnd();
    });
};

UploadItem.prototype.recordLap = function(now, size) {
    var that = this;
    that.lapTimer.laps.push({
        size: size,
        msec: (now - that.lapTimer.prevTime)
    });
    that.lapTimer.laps.splice(0, that.lapTimer.laps.length - LAP_MAX);
    that.lapTimer.prevTime = now;
};

function getBpsAverage(lapList) {
    var totalBps = lapList.reduce(function(totalBps, lap) {
        var bps;
        if (lap.size > 0 && lap.msec > 0) {
            bps = lap.size / lap.msec / 1000;
        } else {
            bps = 0;
        }
        return totalBps + bps;
    }, 0);
    return totalBps / lapList.length;
}

function getRemainingTime(remainingSize, uploadBps) {
    var needSec = Math.floor(remainingSize / uploadBps);

    var hour = Math.floor(needSec / 60);
    var sec = needSec - (hour * 60);
    if (isNaN(hour)) hour = 0;
    if (isNaN(sec)) sec = 0;

    var remainingTime = (hour > 10 ? '': '0') + hour + ':' + (sec > 10 ? '': '0') + sec;
    return remainingTime;
}

UploadItem.prototype.onData = function(size, totalSize) {
    var that = this;
    var now = new Date().getTime();

    // エラー発生後は読み込みを止める
    if (that.raiseError) {
        return;
    }

    // 読み込みが完了したサイズを記録
    that.size += size;
    that.totalSize = totalSize;

    // ラップタイムを記録
    that.recordLap(now, size);

    // 平均アップロード速度を算出
    var uploadBps = getBpsAverage(that.lapTimer.laps);

    // 終了予想を算出
    var remainingTime = getRemainingTime((that.totalSize - that.size), uploadBps);

    // アップロード進捗を％に換算
    that.percent = Math.round(that.size / that.totalSize * 100);
    if (100 < that.percent) {
        that.percent = 100;
    }

    // 行末の進捗表示を更新
    var ratio = that.percent + '％(';
    if (that.retryCount > 0) {
        ratio += 'Retry=' + that.retryCount;
        ratio += ', ';
    }
    ratio += remainingTime + ', ';
    ratio += pretty(uploadBps, true, true) + 'Bps, ';
    ratio += pretty(that.size, true, true) + '/';
    ratio += pretty(that.totalSize, true, true);
    ratio += ')    ';
    that.meter.percent(that.percent, ratio);
};

UploadItem.prototype.saveErrorLog = function(err) {
    var that = this;

    var date = moment().format("YYYY-MM-DD_HH.mm.ss.SSS");
    var logFilePath = './error-' + date + '-' + path.parse(that.fromPath).base + '.log';
    var message = makeErrorMessage(err);
    fs.writeFileSync(logFilePath, message);
};

UploadItem.prototype.onError = function(err) {
    var that = this;

    if (err.extra && err.extra.res.statusCode === 500) {
        that.canRetry = true;
    }
    if (err.code === 'ETIMEDOUT') {
        that.canRetry = true;
    }

    that.raiseError = true;
    that.meter.percent(that.percent, ' *** error *** ');
    if (ENABLE_LOGFILE) {
        that.saveErrorLog(err);
    }
};

UploadItem.prototype.onEnd = function() {
    if (this.canRetry && this.retryCount < RETRY_MAX) {
        this.init();
        this.retryCount++;

        this.start(this.meter, this.done);
    } else {
        this.done();
    }
};

module.exports = UploadItem;
