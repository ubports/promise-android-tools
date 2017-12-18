"use strict";

/*
 * Copyright (C) 2017 Marius Gripsgard <marius@ubports.com>
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

const startCommands = "format system\n\
load_keyring image-master.tar.xz image-master.tar.xz.asc\n\
load_keyring image-signing.tar.xz image-signing.tar.xz.asc\n\
mount system"
const endCommands = "\nunmount system\n"
const DEFAULT_HOST = "https://system-image.ubports.com/";
const downloadPath = "./test";
const ubuntuCommandFile = "ubuntu_command";
const ubuntuPushDir = "/cache/recovery/"
const gpg = ["image-signing.tar.xz", "image-signing.tar.xz.asc", "image-master.tar.xz", "image-master.tar.xz.asc"]

class Client {
  constructor(options) {
    this.host = DEFAULT_HOST;
    this.path = downloadPath;
    this.deviceIndex = [];

    if (options) {
      if (options.host)
        this.host = options.host
      if (options.port)
        this.port = options.port
      if (options.path)
        this.path = options.path
    }
  }

  // Install commands
  createInstallCommands(files, installerCheck, wipe, enable) {
    var cmd = startCommands;
    if (wipe === true) cmd += "\nformat data"
    if (files.constructor !== Array)
      return false;
    files.forEach((file) => {
      cmd += "\nupdate " + path.basename(file.path) + " " + path.basename(file.signature);
    })
    if (enable) {
      if (enable.constructor === Array) {
        enable.forEach((en) => {
          cmd += "\nenable " + en;
        })
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
    var file = downloadPath + "/commandfile/" + ubuntuCommandFile + device + getRandomInt(1000, 9999);
    fs.writeFileSync(file, cmds);
    return file;
  }

  // HTTP functions
  getChannelsIndex() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      http.get({
        url: _this.host + "channels.json",
        json: true
      }, (err, res, bod) => {
        if (err || res.statusCode !== 200) {
          reject(err);
          return;
        }
        resolve(bod);
      });
    });
  }

  getDeviceIndex(device, channel) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      http.get({
        url: _this.host + channel + "/" + device + "/index.json",
        json: true
      }, (err, res, bod) => {
        if (err || res.statusCode !== 200) {
          reject(err);
          return;
        }
        resolve(bod);
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

  getLatestVesion(device, channel) {
    return this.getDeviceIndex(device, channel).then((index) => {
      //TODO optimize with searching in reverse, but foreach is safer
      // to use now to be sure we get latest version
      var latest = false;
      index.images.forEach((img) => {
        if (img.type === "full" && (!latest || latest.version < img.version)) {
          latest = img;
        }
      })
      return latest;
    });
  }

  getGgpUrlsArray() {
    var gpgUrls = [];
    gpg.forEach((g) => {
      gpgUrls.push({
        url: this.host + "/gpg/" + g,
        path: downloadPath + "gpg"
      })
    })
    return gpgUrls;
  }

  getFilesUrlsArray(index) {
    var ret = [];
    index.files.forEach((file) => {
      ret.push({
        url: this.host + file.path,
        path: downloadPath + "pool",
        checksum: file.checksum
      })
      ret.push({
        url: this.host + file.signature,
        path: downloadPath + "pool"
      })
    })
    return ret;
  }

  getFileBasenameArray(urls) {
    var files = [];
    urls.forEach((url) => {
      files.push(path.basename(url.url));
    });
    return files;
  }

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

module.exports = Client
