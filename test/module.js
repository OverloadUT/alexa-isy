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
            name: 'A device that will error in the ISY99 module',
            address: "error"
        },
        {
            name: 'A device that will fail in the ISY99 module',
            address: "unsuccessful"
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
        sendDeviceCommandStub.yields(null, true);
        sendDeviceCommandStub.withArgs('error').yields(new Error('error from isy'), null);
        sendDeviceCommandStub.withArgs('unsuccessful').yields(null, false);
        sendProgramCommandStub = sinon.stub(lambda._private.isy, 'sendProgramCommand');
        sendProgramCommandStub.yields(null, true);
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
        request.request.intent.slots.Device.value = 'A device that will error in the ISY99 module';
        request.request.intent.slots.Action.value = 'on';

        lambda.handler(request, {
            succeed: function() {
                // TODO should have a method that validates all "succeed" responses as valid Alexa responses.
                // TODO this is not actually validating that the response is as expected.
                done();
            },
            fail: fail
        });
    });

    it('should gracefully handle an "unsuccessful" response from the ISY', function (done) {
        request.request.intent.slots.Device.value = 'A device that will fail in the ISY99 module';
        request.request.intent.slots.Action.value = 'on';

        lambda.handler(request, {
            succeed: function() {
                // TODO should have a method that validates all "succeed" responses as valid Alexa responses.
                // TODO this is not actually validating that the response is as expected.
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

describe('Activate Scene', function () {
    var lambda = require('../alexa-isy');
    var request = require('./IntentRequest_ActivateSceneIntent.json');
    var sendDeviceCommandStub;
    var sendProgramCommandStub;

    var fail = function(done) {
        expect('this should never get called').to.be.null;
        done();
    };

    lambda._private.config.scenes = [
        {
            name: 'A simple Insteon scene',
            address: "1"
        },
        {
            name: 'A scene that will error in the ISY99 module',
            address: "error"
        },
        {
            name: 'A scene that will fail in the ISY99 module',
            address: "unsuccessful"
        },
        {
            name: 'Program based scene', type: 'program', address: {
                address:'4',
                cmd:'runIf'
            }
        }
    ];

    beforeEach(function () {
        sendDeviceCommandStub = sinon.stub(lambda._private.isy, 'sendDeviceCommand');
        sendDeviceCommandStub.yields(null, true);
        sendDeviceCommandStub.withArgs('error').yields(new Error('error from isy'), null);
        sendDeviceCommandStub.withArgs('unsuccessful').yields(null, false);
        sendProgramCommandStub = sinon.stub(lambda._private.isy, 'sendProgramCommand');
        sendProgramCommandStub.yields(null, true);
    });

    afterEach(function () {
        sinon.restore(lambda._private.isy, 'sendDeviceCommand');
        sinon.restore(lambda._private.isy, 'sendProgramCommand');
    });

    it('should activate a simple Insteon scene', function (done) {
        request.request.intent.slots.Scene.value = 'A simple Insteon scene';

        lambda.handler(request, {
            succeed: function() {
                expect(sendDeviceCommandStub).to.have.been.calledWith('1','DON');
                done();
            },
            fail: fail
        });
    });

    it('should handle close match on scene name', function (done) {
        request.request.intent.slots.Scene.value = 'A simpple inston scen';

        lambda.handler(request, {
            succeed: function() {
                expect(sendDeviceCommandStub).to.have.been.calledWith('1','DON');
                done();
            },
            fail: fail
        });
    });

    it('should handle program-based scene turning on', function (done) {
        request.request.intent.slots.Scene.value = 'Program based scene';

        lambda.handler(request, {
            succeed: function() {
                expect(sendProgramCommandStub).to.have.been.calledWith('4','runIf');
                done();
            },
            fail: fail
        });
    });

    it('should gracefully handle errors from the isy99 module', function (done) {
        request.request.intent.slots.Scene.value = 'A scene that will error in the ISY99 module';

        lambda.handler(request, {
            succeed: function() {
                // TODO should have a method that validates all "succeed" responses as valid Alexa responses.
                expect(sendDeviceCommandStub).to.have.been.calledOnce;
                done();
            },
            fail: fail
        });
    });

    it('should gracefully handle an "unsuccessful" response from the ISY', function (done) {
        request.request.intent.slots.Scene.value = 'A scene that will fail in the ISY99 module';

        lambda.handler(request, {
            succeed: function() {
                // TODO should have a method that validates all "succeed" responses as valid Alexa responses.
                // TODO this is not actually validating that the response is as expected.
                expect(sendDeviceCommandStub).to.have.been.calledOnce;
                done();
            },
            fail: fail
        });
    });

    it("should handle requests for a device that doesn't exist", function (done) {
        request.request.intent.slots.Scene.value = 'A scene that does not exist in the house config';

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