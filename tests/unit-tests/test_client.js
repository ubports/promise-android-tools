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

const fs = require('fs')
const request = require('request')

const chai = require('chai')
var sinonChai = require("sinon-chai");
var expect = chai.expect;
chai.use(sinonChai);

const SystemImageClient = require('../../src/module.js').Client
const channelJson = require("../test-data/normal-channels.json")
const baconIndexJson = require("../test-data/bacon-index.json")
const baconLatestVersionJson = require("../test-data/bacon-latest-version.json")

describe('Client module', function() {
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
      })
    })
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
      })
    })
  })
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
      })
    })
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
      })
    })
  })
  describe("getLatestVesion()", function() {
    it("should return latest version", function() {
      const requestStub = this.sandbox.stub(request, 'get').callsFake(function(url, cb) {
        cb(false, {statusCode: 200}, baconIndexJson);
      });

      const sic = new SystemImageClient();
      return sic.getLatestVesion("bacon", "ubports-touch/15.04/devel").then((result) => {
        expect(result).to.eql(baconLatestVersionJson);
        expect(requestStub).to.have.been.calledWith({
          url: "https://system-image.ubports.com/ubports-touch/15.04/devel/bacon/index.json",
          json: true
        });
      })
    })
    it("should return error", function() {
      const requestStub = this.sandbox.stub(request, 'get').callsFake(function(url, cb) {
        cb(true, {statusCode: 500}, baconIndexJson);
      });

      const sic = new SystemImageClient();
      return sic.getLatestVesion("bacon", "ubports-touch/15.04/devel").then(() => {}).catch((err) => {
        expect(err).to.eql(true);
        expect(requestStub).to.have.been.calledWith({
          url: "https://system-image.ubports.com/ubports-touch/15.04/devel/bacon/index.json",
          json: true
        });
      })
    })
  })
})
