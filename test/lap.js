var pretty = require('prettysize');
var LAP_MAX = 10;

var totalSize = 65536 * 3;

var data = {};
data.lapTimer = {
    startTime: new Date().getTime(),
    prevTime: 0,
    laps: [
        { size: 65536, msec: 5000/* 1sec */ },
        { size: 25536, msec: 12000/* 1sec */ }
    ]
};

data.lapTimer.laps.splice(0, data.lapTimer.laps.length - LAP_MAX);

var size = 0;
var uploadBps = data.lapTimer.laps.reduce(function(bytePerSec, lap) {
    // 平均アップロード速度を算出
    size += lap.size;
    var bps = lap.size / (lap.msec / 1000);
    return (bytePerSec + bps) / (bytePerSec > 0 ? 2 : 1);
}, 0);

//size = totalSize;

// 残り時間予想
console.log(size,           // アップロード済容量
        totalSize,          // 総容量
        (totalSize - size), // 残り容量
        Math.floor((totalSize - size) / uploadBps)  // 残り必要な秒数
);

var needSec = Math.floor((totalSize - size) / uploadBps);
var hour = Math.floor(needSec / 60);
var sec = needSec - (hour * 60);
var remainingTime = (hour > 10 ? '': '0') + hour + ':' + (sec > 10 ? '': '0') + sec;

console.log(needSec, hour, sec, remainingTime);

console.log('end', pretty(uploadBps, true, true) + 'Bps, ' + remainingTime);
