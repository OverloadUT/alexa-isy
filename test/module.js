/* jshint node: true */
'use strict';
process.env.NODE_ENV = 'test';
var expect = require('chai').expect;
var sinon = require('sinon');

describe('Main Handler', function () {
    var lambda;
    var succeed;
    var fail;
    var callback;

    beforeEach(function(){
        lambda = require('../alexa-isy');
        succeed = sinon.spy();
        fail = sinon.spy();
        callback = {
            succeed: succeed,
            fail: fail
        };
    });

    it('should handle LaunchRequest', function () {
        var LaunchRequest = require('./LaunchRequest.json');

        lambda.handler(LaunchRequest, callback);
        expect(succeed.calledOnce).to.be.true;
    });

    it('should handle SessionEndedRequest', function () {
        var SessionEndedRequest = require('./SessionEndedRequest.json');

        lambda.handler(SessionEndedRequest, callback);
        expect(succeed.calledOnce).to.be.true;
        expect(succeed.alwaysCalledWithExactly()).to.be.true;
    });
});

// describe('Get Device', function(){
//     var isy = require('../index.js')();

//     before(function(done){
//         sinon
//             .stub(isy._restClient, "get", function(device, callback){
//                 callback('<nodeInfo><node flag="128"><address>12 34 56 7</address><name>Device Name</name><parent type="3">8555</parent><type>1.32.64.0</type><enabled>true</enabled><deviceClass>0</deviceClass><wattage>0</wattage><dcPeriod>0</dcPeriod><pnode>1C AB 43 1</pnode><ELK_ID>A03</ELK_ID><property id="ST" value="255" formatted="On" uom="%/on/off"/></node><properties><property id="OL" value="255" formatted="100" uom="%/on/off"/><property id="RR" value="28" formatted="0.5 " uom="seconds"/><property id="ST" value="255" formatted="On" uom="%/on/off"/></properties></nodeInfo>', "");
//             });
//         done();
//     });
//     it('Should get Device info from API', function(done) {
//         isy.getDeviceInfo("12 34 56 7", function(err, device){
//             expect(device.address).to.equal("12 34 56 7");
//             expect(device.name).to.equal("Device Name");
//             expect(device.status).to.equal('255');
//             expect(device.statusFormatted).to.equal("On");
//             done();
//         });
//     });
// });