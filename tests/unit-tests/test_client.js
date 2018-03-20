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

const fs = require('fs');
const request = require('request');

const chai = require('chai');
var sinonChai = require("sinon-chai");
var expect = chai.expect;
chai.use(sinonChai);

const SystemImageClient = require('../../src/module.js').Client;
const channelJson = require("../test-data/normal-channels.json");
const baconIndexJson = require("../test-data/bacon-index.json");
const baconLatestVersionJson = require("../test-data/bacon-latest-version.json");
const commandfileJson = require("../test-data/commandfile.json");
const filesUrlsJson = require("../test-data/files-urls.json");

describe('Client module', function() {
  describe("constructor()", function() {
    it("should create default client", function() {
      const sic = new SystemImageClient();
      expect(sic.host).to.eql("https://system-image.ubports.com/");
      expect(sic.path).to.eql("./test");
      expect(sic.cache_time).to.eql(180);
    });

    it("should create custom client", function() {
      const sic = new SystemImageClient({
        host: "https://system-image.example.com/",
        path: "./custom-test",
        cache_time: 240
      });
      expect(sic.host).to.eql("https://system-image.example.com/");
      expect(sic.path).to.eql("./custom-test");
      expect(sic.cache_time).to.eql(240);
    });

    it("should ensure trailing slash", function() {
      const sic = new SystemImageClient({
        host: "https://system-image.example.com"
      });
      expect(sic.host).to.eql("https://system-image.example.com/");
    });

    it("should return insecure error", function() {
      try {
        const sic = new SystemImageClient({
          host: "http://system-image.example.com/"
        });
      } catch (err) {
        expect(err.message).to.equal("Insecure URL! Call with allow_insecure to ignore.");
      };
    });

    it("should ensure create insecure client", function() {
      const sic = new SystemImageClient({
        host: "http://system-image.example.com/",
        allow_insecure: true
      });
      expect(sic.host).to.eql("http://system-image.example.com/");
    });

    it("should return invalid url error", function() {
      try {
        const sic = new SystemImageClient({
          host: "definitely not a valid url"
        });
      } catch (err) {
        expect(err.message).to.equal("Host is not a valid URL!");
      };
    });

    it("should return invalid url with no host", function() {
      try {
        const sic = new SystemImageClient({
          path: "./custom-test",
          cache_time: 240
        });
      } catch (err) {
        expect(err.message).to.equals("Host is not a valid URL!");
      };
    });
  });

  describe("createInstallCommands()", function() {
    it("should return install commands", function() {
      const sic = new SystemImageClient();
      var result = sic.createInstallCommands(baconLatestVersionJson.files, true, true, [1, 2, 3]);
      expect(result).to.eql(commandfileJson);
    });

    it("should return error commands", function() {
      const sic = new SystemImageClient();
      var result = sic.createInstallCommands(4, true, true, [1, 2, 3]);
      expect(result).to.eql(false);
    });
  });

  describe("createInstallCommandsFile()", function() {
    it("should create install commands file", function() {
      const sic = new SystemImageClient();
      var file = sic.createInstallCommandsFile(commandfileJson, "bacon");
      expect(file.indexOf("./test/commandfile/ubuntu_commandbacon") != -1).to.eql(true);
      expect(fs.readFileSync(file).toString()).to.eql(commandfileJson);
    });
    // TODO introduce a test case with invalid input
  });

  describe("getChannels()", function() {
    it("should return channels", function() {
      const requestStub = this.sandbox.stub(request, 'get').callsFake(function(url, cb) {
        cb(false, {statusCode: 200}, channelJson);
      });

      const sic = new SystemImageClient();
      return sic.getChannels().then((result) => {
        expect(result).to.eql(['ubports-touch/15.04/devel',
          'ubports-touch/15.04/rc',
          'ubports-touch/15.04/stable',
          'ubports-touch/16.04/devel'
        ]);
        expect(requestStub).to.have.been.calledWith({
          url: "https://system-image.ubports.com/channels.json",
          json: true
        });
      });
    });

    it("should return error", function() {
      const requestStub = this.sandbox.stub(request, 'get').callsFake(function(url, cb) {
        cb(true, {statusCode: 500}, channelJson);
      });

      const sic = new SystemImageClient();
      return sic.getChannels().then(() => {}).catch((err) => {
        expect(err).to.eql(true);
        expect(requestStub).to.have.been.calledWith({
          url: "https://system-image.ubports.com/channels.json",
          json: true
        });
      });
    });
  });

  describe("getDeviceChannels()", function() {
    it("should return device channels", function() {
      const requestStub = this.sandbox.stub(request, 'get').callsFake(function(url, cb) {
        cb(false, {statusCode: 200}, channelJson);
      });

      const sic = new SystemImageClient();
      return sic.getDeviceChannels("krillin").then((result) => {
        expect(result).to.eql(['ubports-touch/15.04/devel',
          'ubports-touch/15.04/rc',
          'ubports-touch/15.04/stable'
        ]);
        expect(requestStub).to.have.been.calledWith({
          url: "https://system-image.ubports.com/channels.json",
          json: true
        });
      });
    });

    it("should return error", function() {
      const requestStub = this.sandbox.stub(request, 'get').callsFake(function(url, cb) {
        cb(true, {statusCode: 500}, channelJson);
      });

      const sic = new SystemImageClient();
      return sic.getDeviceChannels("krillin").then(() => {}).catch((err) => {
        expect(err).to.eql(true);
        expect(requestStub).to.have.been.calledWith({
          url: "https://system-image.ubports.com/channels.json",
          json: true
        });
      });
    });
  });

  describe("getLatestVersion()", function() {
    it("should return latest version", function() {
      const requestStub = this.sandbox.stub(request, 'get').callsFake(function(url, cb) {
        cb(false, {statusCode: 200}, baconIndexJson);
      });

      const sic = new SystemImageClient();
      return sic.getLatestVersion("bacon", "ubports-touch/15.04/devel").then((result) => {
        expect(result).to.eql(baconLatestVersionJson);
        expect(requestStub).to.have.been.calledWith({
          url: "https://system-image.ubports.com/ubports-touch/15.04/devel/bacon/index.json",
          json: true
        });
      });
    });

    it("should return error", function() {
      const requestStub = this.sandbox.stub(request, 'get').callsFake(function(url, cb) {
        cb(true, {statusCode: 500}, baconIndexJson);
      });
      const sic = new SystemImageClient();
      return sic.getLatestVersion("bacon", "ubports-touch/15.04/devel").then(() => {}).catch((err) => {
        expect(err).to.eql(true);
        expect(requestStub).to.have.been.calledWith({
          url: "https://system-image.ubports.com/ubports-touch/15.04/devel/bacon/index.json",
          json: true
        });
      });
    });
  });

  describe("getGgpUrlsArray()", function() {
    it("should return gpg urls array", function() {
      const sic = new SystemImageClient();
      expect(sic.getGgpUrlsArray()).to.eql([
        { "path": "./testgpg", "url": "https://system-image.ubports.com/gpg/image-signing.tar.xz" },
        { "path": "./testgpg", "url": "https://system-image.ubports.com/gpg/image-signing.tar.xz.asc" },
        { "path": "./testgpg", "url": "https://system-image.ubports.com/gpg/image-master.tar.xz" },
        { "path": "./testgpg", "url": "https://system-image.ubports.com/gpg/image-master.tar.xz.asc" }
      ]);
    });
  });

  describe("getFilesUrlsArray()", function() {
    it("should return files urls", function() {
      const sic = new SystemImageClient();
      expect(sic.getFilesUrlsArray(baconLatestVersionJson)).to.eql(filesUrlsJson);
    });
    it("should return error", function() {
      const sic = new SystemImageClient();
      try {
        sic.getFilesUrlsArray([]);
      } catch (err) {
        expect(err.message).to.eql("Cannot read property 'forEach' of undefined");
      }
    });
  })

  describe("getFilePushArray()", function() {
    it("should return files urls", function() {
      const sic = new SystemImageClient();
      expect(sic.getFilePushArray(filesUrlsJson)).to.eql(require("../test-data/file-push.json"));
    });
    it("should return error", function() {
      const sic = new SystemImageClient();
      try {
        sic.getFilePushArray([]);
      } catch (err) {
        expect(err.message).to.eql("Cannot read property 'forEach' of undefined");
      }
    });
  });
});
