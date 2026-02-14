class Tracker {
  constructor(fpath) {
    this.fpath = fpath;
  }

  async check_tracker_exists() {
    return require("fs").existsSync(fpath);
  }

  async check_tracker_valid() {
    try {
      JSON.parse(fstring);
      return true;
    } catch (error) {
      return false;
    }
  }

  async check_tracker_read() {
    return require("fs").readFileSync(fpath);
  }
}
module.exports.Tracker = Tracker;
