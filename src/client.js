"use strict";

/*
 * Copyright (C) 2017-2018 Marius Gripsgard <marius@ubports.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const http = require("request");
const os = require("os");
const fs = require("fs");
const path = require("path");
const mkdirp = require('mkdirp');
const common = require("./common.js")

const time = () => Math.floor(new Date() / 1000);

const startCommands = "format system\n\
load_keyring image-master.tar.xz image-master.tar.xz.asc\n\
load_keyring image-signing.tar.xz image-signing.tar.xz.asc\n\
mount system";
const endCommands = "\nunmount system\n";
const DEFAULT_HOST = "https://system-image.ubports.com/";
const DEFAULT_CACHE_TIME = 180; // 3 minutes
const downloadPath = "./test";
const ubuntuCommandFile = "ubuntu_command";
const ubuntuPushDir = "/cache/recovery/";
const gpg = ["image-signing.tar.xz", "image-signing.tar.xz.asc", "image-master.tar.xz", "image-master.tar.xz.asc"];

class Client {
  constructor(options) {
    this.host = DEFAULT_HOST;
    this.cache_time = DEFAULT_CACHE_TIME;
    this.path = downloadPath;
    this.deviceIndex = {};
    this.deviceIndexCache = 0;
    this.channelsIndex = {};
    this.channelsIndexCache = 0;

    // accept options
    if (options) {
      if (options.host) {
        // validate URL
        if (options.host.match(/https?:\/\/(www\.)?[-a-z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-z0-9@:%_\+.~#?&//=]*)/i)) {
          // ensure https
          if (!options.allow_insecure && options.host.includes("http://")) {
            throw new Error("Insecure URL! Call with allow_insecure to ignore.");
          }
          // ensure trailing slash
          this.host = options.host + (options.host.slice(-1) != "/" ? "/" : "");
        } else {
          throw new Error("Host is not a valid URL!");
        }
      }
      if (options.path) {
        this.path = options.path;
      }
      if (options.cache_time) {
        this.cache_time = options.cache_time;
      }
    }
  }

  // Install commands
  // QUESTION Should this be public? Maybe call it from createInstallCommandsFile
  createInstallCommands(files, installerCheck, wipe, enable) {
    var cmd = startCommands;
    if (wipe === true) cmd += "\nformat data";
    if (files.constructor !== Array)
      return false;
    files.forEach((file) => {
      cmd += "\nupdate " + path.basename(file.path) + " " + path.basename(file.signature);
    });
    if (enable) {
      if (enable.constructor === Array) {
        enable.forEach((en) => {
          cmd += "\nenable " + en;
        });
      }
    }
    cmd += endCommands;
    if (installerCheck) cmd += "\ninstaller_check";
    return cmd;
  }

  createInstallCommandsFile(cmds, device) {
    if (!fs.existsSync(downloadPath + "/commandfile/")) {
      mkdirp.sync(downloadPath + "/commandfile/");
    }
    var file = downloadPath + "/commandfile/" + ubuntuCommandFile + device + common.getRandomInt(1000, 9999);
    fs.writeFileSync(file, cmds);
    return file;
  }

  // HTTP functions
  // QUESTION Should this be public?
  getChannelsIndex() {
    const _this = this;
    return new Promise(function(resolve, reject) {
      var now=time();
      if (_this.channelsIndexCache > now)
        return resolve(_this.channelsIndex);
      http.get({
        url: _this.host + "channels.json",
        json: true
      }, (err, res, bod) => {
        if (err || res.statusCode !== 200) {
          reject(err);
          return;
        }
        _this.channelsIndex = bod;
        _this.channelsIndexCache = time()+_this.cache_time;
        resolve(_this.channelsIndex);
      });
    });
  }

  // QUESTION Should this be public?
  getDeviceIndex(device, channel) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      var now=time();
      if (_this.deviceIndexCache > now)
        return resolve();
      http.get({
        url: _this.host + channel + "/" + device + "/index.json",
        json: true
      }, (err, res, bod) => {
        if (err || res.statusCode !== 200) {
          reject(err);
          return;
        }
        _this.deviceIndex = bod;
        _this.deviceIndexCache = time()+_this.cache_time;
        resolve(_this.deviceIndex);
      });
    });
  }

  getChannels() {
    return this.getChannelsIndex().then((_channels) => {
      var channels = [];
      for (var channel in _channels) {
        if (_channels[channel].hidden || _channels[channel].redirect)
          continue;
        channels.push(channel);
      }
      return channels;
    });
  }

  getDeviceChannels(device) {
    return this.getChannelsIndex().then((channels) => {
      var deviceChannels = [];
      for (var channel in channels) {
        if (channels[channel].hidden || channels[channel].redirect)
          continue;
        if (device in channels[channel]["devices"]) {
          deviceChannels.push(channel);
        }
      }
      return deviceChannels;
    });
  }

  // FIXME: Some people might perfer to get the latest *version* instead
  getLatestVersion(device, channel) {
    return this.getDeviceIndex(device, channel).then((index) => {
      //TODO optimize with searching in reverse, but foreach is safer
      // to use now to be sure we get latest version
      var latest = false;
      index.images.forEach((img) => {
        if (img.type === "full" && (!latest || latest.version < img.version)) {
          latest = img;
        }
      });
      return latest;
    });
  }

  getGgpUrlsArray() {
    var gpgUrls = [];
    gpg.forEach((g) => {
      gpgUrls.push({
        url: this.host + "gpg/" + g,
        path: downloadPath + "gpg"
      });
    });
    return gpgUrls;
  }

  getFilesUrlsArray(index) {
    var ret = [];
    index.files.forEach((file) => {
      ret.push({
        url: this.host + file.path,
        path: downloadPath + "pool",
        checksum: file.checksum
      });
      ret.push({
        url: this.host + file.signature,
        path: downloadPath + "pool"
      });
    });
    return ret;
  }

  // QUESTION Is this still needed?
  getFileBasenameArray(urls) {
    var files = [];
    urls.forEach((url) => {
      files.push(path.basename(url.url));
    });
    return files;
  }

  // QUESTION Is this still needed?
  getFilePathArray(urls) {
    var files = [];
    urls.forEach((url) => {
      files.push(url.path + "/" + path.basename(url.url));
    });
    return files;
  }

  getFilePushArray(urls) {
    var files = [];
    urls.forEach((url) => {
      files.push({
        src: url.path + "/" + path.basename(url.url),
        dest: ubuntuPushDir
      });
    });
    return files;
  }
}

module.exports = Client;
