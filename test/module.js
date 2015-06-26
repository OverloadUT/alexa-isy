/* jshint node: true */
process.env.NODE_ENV = 'test';
var sinon = require('sinon');
var chai = require('chai');
var sinonChai = require("sinon-chai");
chai.use(sinonChai);
var expect = require('chai').expect;
require('dotenv').config({path: './test/.env'});

describe('Main Handler edge cases', function () {
    var lambda = require('../alexa-isy');
    var succeed;
    var fail;
    var callback;

    beforeEach(function(){
        succeed = sinon.spy();
        fail = sinon.spy();
        callback = {
            succeed: succeed,
            fail: fail
        };
    });

    it('should reject invalid AppID', function () {
        var request = require('./LaunchRequestInvalidApp.json');

        lambda.handler(request, callback);
        expect(fail).to.have.been.calledOnce;
        expect(succeed).to.not.have.been.called;
    });

    it('should handle LaunchRequest', function () {
        var request = require('./LaunchRequest.json');

        lambda.handler(request, callback);
        expect(succeed).to.have.been.calledOnce;
    });

    it('should handle SessionEndedRequest', function () {
        var request = require('./SessionEndedRequest.json');

        lambda.handler(request, callback);
        expect(succeed).to.have.been.calledOnce;
        expect(succeed).to.have.always.been.calledWithExactly();
    });

    it('should gracefully fail on unknown request type', function () {
        var request = require('./UnknownRequestType.json');

        lambda.handler(request, callback);
        expect(fail).to.have.been.calledOnce;
        expect(succeed).to.not.have.been.called;
    });

    it('should gracefully fail on empty request', function () {
        lambda.handler({}, callback);
        expect(fail).to.have.been.calledOnce;
        expect(succeed).to.have.not.been.called;
    });

    it('should gracefully fail on unknown Intent', function () {
        var request = require('./IntentRequest_UnknownIntent.json');

        lambda.handler(request, callback);
        expect(fail).to.have.been.calledOnce;
        expect(succeed).to.have.not.been.called;
    });
});

describe('Adjust Device', function () {
    var lambda = require('../alexa-isy');
    var request = require('./IntentRequest_AdjustDeviceIntent.json');
    var sendDeviceCommandStub;
    var sendProgramCommandStub;

    var fail = function(done) {
        expect('this should never get called').to.be.null;
        done();
    };

    lambda._private.config.devices = [
        {
            name: 'Simple device',
            address: "1"
        },
        {
            name: 'A device that will fail in the ISY99 module',
            address: "fail"
        },
        {
            name: 'Device with different commands for on and off',
            address: { on: "2", off: "3"}
        },
        {name: 'Program based device', type: 'program', address:{
            on: {address:'4', cmd:'runIf'},
            off: {address:'5', cmd:'runThen'}}
        }
    ];

    lambda._private.config.actions = [
        {name: 'on', meaning: 'on', command:'DON'},
        {name: 'off', meaning: 'off', command:'DOF'},
        {name: 'fast off', meaning: 'off', command:'DFOF'}
    ];

    beforeEach(function () {
        sendDeviceCommandStub = sinon.stub(lambda._private.isy, 'sendDeviceCommand');
        sendDeviceCommandStub.callsArgWith(2, null, 200);
        sendDeviceCommandStub.withArgs('fail').callsArgWith(2, 'error from isy', 404);
        sendProgramCommandStub = sinon.stub(lambda._private.isy, 'sendProgramCommand');
        sendProgramCommandStub.callsArgWith(2, null, 200);
    });

    afterEach(function () {
        sinon.restore(lambda._private.isy, 'sendDeviceCommand');
        sinon.restore(lambda._private.isy, 'sendProgramCommand');
    });

    it('should turn on a simple device', function (done) {
        request.request.intent.slots.Device.value = 'simple device';
        request.request.intent.slots.Action.value = 'on';

        lambda.handler(request, {
            succeed: function() {
                expect(sendDeviceCommandStub).to.have.been.calledWith('1','DON');
                done();
            },
            fail: fail
        });
    });

    it('should turn off a simple device', function (done) {
        request.request.intent.slots.Device.value = 'simple device';
        request.request.intent.slots.Action.value = 'off';

        lambda.handler(request, {
            succeed: function() {
                expect(sendDeviceCommandStub).to.have.been.calledWith('1','DOF');
                done();
            },
            fail: fail
        });
    });

    it('should handle close match on device name', function (done) {
        request.request.intent.slots.Device.value = 'simpl devices';
        request.request.intent.slots.Action.value = 'on';

        lambda.handler(request, {
            succeed: function() {
                expect(sendDeviceCommandStub).to.have.been.calledWith('1','DON');
                done();
            },
            fail: fail
        });
    });

    it('should handle complex device turning on', function (done) {
        request.request.intent.slots.Device.value = 'Device with different commands for on and off';
        request.request.intent.slots.Action.value = 'on';

        lambda.handler(request, {
            succeed: function() {
                expect(sendDeviceCommandStub).to.have.been.calledWith('2','DON');
                done();
            },
            fail: fail
        });
    });

    it('should handle complex device turning off', function (done) {
        request.request.intent.slots.Device.value = 'Device with different commands for on and off';
        request.request.intent.slots.Action.value = 'off';

        lambda.handler(request, {
            succeed: function() {
                expect(sendDeviceCommandStub).to.have.been.calledWith('3','DON');
                done();
            },
            fail: fail
        });
    });

    it('should handle program-based device turning on', function (done) {
        request.request.intent.slots.Device.value = 'Program based device';
        request.request.intent.slots.Action.value = 'on';

        lambda.handler(request, {
            succeed: function() {
                expect(sendProgramCommandStub).to.have.been.calledWith('4','runIf');
                done();
            },
            fail: fail
        });
    });

    it('should handle program-based device turning off', function (done) {
        request.request.intent.slots.Device.value = 'Program based device';
        request.request.intent.slots.Action.value = 'off';

        lambda.handler(request, {
            succeed: function() {
                expect(sendProgramCommandStub).to.have.been.calledWith('5','runThen');
                done();
            },
            fail: fail
        });
    });

    it('should gracefully handle errors from the isy99 module', function (done) {
        request.request.intent.slots.Device.value = 'A device that will fail in the ISY99 module';
        request.request.intent.slots.Action.value = 'on';

        lambda.handler(request, {
            succeed: function() {
                // TODO should have a method that validates all "succeed" responses as valid Alexa responses.
                done();
            },
            fail: fail
        });
    });

    it("should handle requests for a device that doesn't exist", function (done) {
        request.request.intent.slots.Device.value = 'A device that does not exist in the house config';
        request.request.intent.slots.Action.value = 'on';

        lambda.handler(request, {
            succeed: function() {
                // TODO should have a method that validates all "succeed" responses as valid Alexa responses.
                expect(sendDeviceCommandStub).to.not.have.been.called;
                expect(sendProgramCommandStub).to.not.have.been.called;
                done();
            },
            fail: fail
        });
    });

    it("should handle requests for an action that doesn't exist", function (done) {
        request.request.intent.slots.Device.value = 'simple device';
        request.request.intent.slots.Action.value = 'An action that does not exist in the house config';

        lambda.handler(request, {
            succeed: function() {
                // TODO should have a method that validates all "succeed" responses as valid Alexa responses.
                expect(sendDeviceCommandStub).to.not.have.been.called;
                expect(sendProgramCommandStub).to.not.have.been.called;
                done();
            },
            fail: fail
        });
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