const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// progress per millisecond
function estimateSpeed(data) {
  if (data.length < 2) {
    return NaN;
  }

  const [first, last] = [data[0], data[data.length - 1]];
  const deltaTime = last.time - first.time;
  const deltaProgress = last.progress - first.progress;

  if (deltaTime === 0) {
    return NaN;
  }

  return deltaProgress / deltaTime;
}

function printAllEstimates(allData) {
  if (!allData.length) {
    return;
  }

  const latest = allData[allData.length - 1];
  const recentData = allData.filter(d => latest.time - d.time < 5 * 60 * 1000);

  const asRemainingMinutes = (speed) => (1 - latest.progress) / speed / (60 * 1000);

  console.log({
    progress: latest.progress,
    remaningMinutesAll: asRemainingMinutes(estimateSpeed(allData)),
    remainingMinutesRecent: asRemainingMinutes(estimateSpeed(recentData)),
  });
}

const data = [];
rl.on('line', function(line){
  const parts = line.split(' ');
  data.push({ time: +parts[0], progress: +parts[1] });
  printAllEstimates(data);
})
