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

const fs = require("fs");
const checksum = require("checksum");
const path = require("path");

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function checksumFile(file) {
  return new Promise(function(resolve, reject) {
    if (!file.checksum) {
      // No checksum so return true;
      resolve();
      return;
    } else {
      checksum.file(path.join(file.path, path.basename(file.url)), {
        algorithm: "sha256"
      }, function(err, sum) {
        console.log("checked: " +path.basename(file.url), sum === file.checksum);
        if (sum === file.checksum) resolve()
        else reject()
      });
    }
  });
}

function checkFiles(urls) {
  return new Promise(function(resolve, reject) {
    var urls_ = [];
    var next = () => {
      if (urls.length <= 1) {
        resolve(urls_)
      } else {
        urls.shift();
        check()
      }
    }
    var check = () => {
      fs.access(path.join(urls[0].path, path.basename(urls[0].url)), (err) => {
        if (err) {
          console.log("Not existing " + path.join(urls[0].path, path.basename(urls[0].url)));
          urls_.push(urls[0]);
          next();
        } else {
          checksumFile(urls[0]).then(() => {
            console.log(path.join(urls[0].path, path.basename(urls[0].url)) + " exists with the expected checksum, so the download will be skipped.");
            next();
          }).catch(() => {
            console.log("Checksum mismatch on " + path.join(urls[0].path, path.basename(urls[0].url)) + ". This file will be downloaded again.");
            urls_.push(urls[0]);
            next();
          });
        }
      })
    }
    check();
  });
}

module.exports = {
  getRandomInt: getRandomInt,
  checkFiles: checkFiles,
  checksumFile: checksumFile
};
