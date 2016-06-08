"use strict";

var sav_max_seats = require('../../config').sav_max_seats

var exec = require('child_process').exec
  , extend = require('extend')
  , fs = require('fs')
  , Promise = require('promise')
  , sem = require('semaphore')(sav_max_seats)

var logger = require('../logger')
  , mycache = require('../cache')
  , myhash = require("../hash")



/**
 * Scans `payload.filename` with Sophos.
 *
 * Resolve or reject with {
 *  malicious: bool,
 *  scanned: ISO Time string,
 *  hash: hash (sha256 in base64) of that file
 *  result: scan result [clean|VirusName]
 *  error: stderr on error
 * }
 *
 * @param payload
 * @returns Promise
 */
function call_sav_scan(payload) {
  var sav = "/opt/sophos-av/bin/savscan";
  var sav_opt = "-archive -ndi -ss";
  var ptrn = / Virus '(.+)' found in file /;
  var match;


  if (payload.result || !payload.filename) {
    logger.info("Skip sav scan for result or !filename");
    return Promise.resolve(payload);
  }

  logger.info(`Scanning (sophos) ${payload.filename}`);

  return new Promise((fulfill, reject) => {
    sem.take(() => {
      exec(`${sav} ${sav_opt} "${payload.filename}"`, {timeout: 30000}, (err, stdout, stderr) => {
        sem.leave();

        logger.info(`Deleting "${payload.filename}"`);
        try {
          fs.unlink(payload.filename);
        } catch (ex) {
          logger.warn(`FS cleanup "${payload.filename}" failed, err = ${ex}`)
        }

        if (match = stdout.match(ptrn)) {
          payload.malicious = true;
          payload.result = match[1]
        } else if (stdout == '' && stderr == '') {
          payload.result = "clean"
        } else {
          payload.error = stderr;
          payload.status = 500;
          reject(payload);
          return
        }
        logger.info(`Scan result for ${payload.filename}: ${payload.malicious}`);
        delete payload.filename;
        fulfill(payload);
      });
    });
  })
}

function scan_file(filename) {
  return new Promise((fulfill, reject) => {
    myhash.from_filename(filename)
      .then(mycache.get_result)
      .then(call_sav_scan)
      .then(mycache.update_result)
      .then(fulfill, reject)
  });
}

module.exports = {
  call_sav_scan: call_sav_scan,
  scan_file: scan_file
};
