const os = require('os');
const fs = require('fs');

class SystemMonitor {
  constructor() {
    this.stats = {
      timestamp: [],
      cpu: [],
      memory: [],
      loadAvg: [],
    };
    this.interval = null;
  }

  start(interval = 1000) {
    this.interval = setInterval(() => {
      const now = new Date();
      const cpuUsage = this.getCPUUsage();
      const memUsage = this.getMemoryUsage();
      const loadAvg = os.loadavg();

      this.stats.timestamp.push(now);
      this.stats.cpu.push(cpuUsage);
      this.stats.memory.push(memUsage);
      this.stats.loadAvg.push(loadAvg);

      console.log(`[${now.toISOString()}] CPU: ${cpuUsage.toFixed(2)}%, Memory: ${memUsage.toFixed(2)}%, Load: ${loadAvg[0].toFixed(2)}`);
    }, interval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.saveStats();
    }
  }

  getCPUUsage() {
    const cpus = os.cpus();
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce(
      (acc, cpu) =>
        acc + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle,
      0
    );
    return ((1 - totalIdle / totalTick) * 100);
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    return ((1 - free / total) * 100);
  }

  saveStats() {
    const data = {
      timestamp: new Date().toISOString(),
      duration: this.stats.timestamp.length,
      averages: {
        cpu: this.average(this.stats.cpu),
        memory: this.average(this.stats.memory),
        loadAvg: this.average(this.stats.loadAvg.map(load => load[0])),
      },
      peaks: {
        cpu: Math.max(...this.stats.cpu),
        memory: Math.max(...this.stats.memory),
        loadAvg: Math.max(...this.stats.loadAvg.map(load => load[0])),
      },
      raw: this.stats,
    };

    fs.writeFileSync(
      `load-test-stats-${data.timestamp.replace(/[:.]/g, '-')}.json`,
      JSON.stringify(data, null, 2)
    );
  }

  average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

// Start monitoring if run directly
if (require.main === module) {
  const monitor = new SystemMonitor();
  monitor.start();

  // Stop after 10 minutes
  setTimeout(() => {
    monitor.stop();
    process.exit(0);
  }, 10 * 60 * 1000);

  // Handle interrupts
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });
}

module.exports = SystemMonitor; 