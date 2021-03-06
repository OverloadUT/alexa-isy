require('dotenv').load();
var isy = require("isy99")({host:process.env.ISY_HOST,
                            port:process.env.ISY_PORT,
                            user:process.env.ISY_USER,
                            pass:process.env.ISY_PASS,
                            https:process.env.ISY_HTTPS
                          });
var config = {
    // TODO handling natural language actions should really be moved to
    // separate intents, as the Alexa code is likely much better at handling
    // it than we will be
    actions: require('./actions.json').actions,
    devices: loadDevices(),
    scenes: loadScenes()
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Allow untrusted self-signed certificates

function loadDevices() {
    // TODO HACK to load devices from a static file for now.
    // This should be moved to a database of some sort so that it can be configured for each user.
    try {
        return require('./devices.json').devices;
    } catch (e) {
        return {};
    }
}

function loadScenes() {
    // TODO HACK to load devices from a static file for now.
    // This should be moved to a database of some sort so that it can be configured for each user.
    try {
        return require('./scenes.json').scenes;
    } catch (e) {
        return {};
    }
}

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    // TODO all "fail" paths should still return success so we can customize the Alexa responses
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);
        console.log("event.session.user.userId=" + event.session.user.userId);
        
        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app." + process.env.ALEXA_APP_ID) {
            return context.fail("Invalid Application ID");
        }

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                        context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        }  else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                         context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);

            context.succeed();
        } else {
            console.log("Got an unknown RequestType: " + event.request.type);
            context.fail("Unknown request type: " + event.request.type);
        }
    } catch (e) {
        // TODO try catch is bad here
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
                ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the app without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
                ", sessionId=" + session.sessionId);

    getWelcomeResponse(callback);
}

/** 
 * Called when the user specifies an intent for this application.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId +
                ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    if ("AdjustDeviceIntent" === intentName) {
        intentAdjustDevice(intent, session, callback);
    } else if ("ActivateSceneIntent" === intentName) {
        intentActivateScene(intent, session, callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the app returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
                ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

/**
 * Helpers that build all of the responses.
 */
function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "ISY - " + title,
            content: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}

/** 
 * Functions that control the app's behavior.
 */
function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "The House is Ready";

    var repromptText = "You can say things like: 'turn on the lights,' or 'turn off the television.'";
    var shouldEndSession = false;

    var speechOutput = "The House is ready for a command.";

    callback(sessionAttributes,
             buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function intentAdjustDevice(intent, session, callback) {
    var didYouMean = require("didyoumean");
    didYouMean.returnWinningObject = true;

    var sessionAttributes = session.attributes || {};
    var cardTitle = "Adjust House Device";
    var repromptText = "";
    var shouldEndSession = true;

    console.log("intentAdjustDevice", intent.slots);

    var spokenDevice = intent.slots.Device.value;
    var device = didYouMean(spokenDevice, config.devices, 'name');

    if (device === null) {
        callback(sessionAttributes,
                 buildSpeechletResponse(cardTitle, "Sorry, I am not sure which device that is", repromptText, shouldEndSession));
    } else {
        var action = didYouMean(intent.slots.Action.value, config.actions, 'name');
        if (action === null) {
            callback(sessionAttributes,
                     buildSpeechletResponse(cardTitle, "Sorry, I do not understand what Action that is", repromptText, shouldEndSession));
        } else {
            var address;
            var command;
            if(typeof device.address === 'string') {
                // Simple device with a single address for all commands
                address = device.address;
                command = action.command;
            } else {
                // Complex device with different addresses for on and off
                address = device.address[action.meaning];
                if (typeof address === 'string') {
                    command = 'DON';
                } else {
                    // Even more complex device (a program most likely) that requires custom commands with each address
                    address = device.address[action.meaning].address;
                    command = device.address[action.meaning].cmd;
                }
            }

            var commandCallback = function(err, statusCode){
                if(err) {
                    console.log(err);
                    callback(sessionAttributes,
                             buildSpeechletResponse(cardTitle, "There was an issue connecting to the home automation controller", repromptText, shouldEndSession));
                } else {
                    console.log(statusCode);
                    var speechOutput = "Done!";
                    callback(sessionAttributes,
                             buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
                }
            };

            if(device.type == "program") {
                console.log('isy.sendProgramCommand',address, command);
                isy.sendProgramCommand(address, command, commandCallback);
            } else {
                console.log('isy.sendDeviceCommand',address, command);
                isy.sendDeviceCommand(address, command, commandCallback);
            }
        }

    }
}

function intentActivateScene(intent, session, callback) {
    var didYouMean = require("didyoumean");
    didYouMean.returnWinningObject = true;

    var sessionAttributes = session.attributes || {};
    var cardTitle = "Activate Scene";
    var repromptText = "";
    var shouldEndSession = true;

    console.log("intentActivateScene", intent.slots);

    var spokenScene = intent.slots.Scene.value;
    var scene = didYouMean(spokenScene, config.scenes, 'name');

    if (scene === null) {
        callback(sessionAttributes,
                 buildSpeechletResponse(cardTitle, "Sorry, I am not sure which scene that is. I heard you say " + spokenScene, repromptText, shouldEndSession));
    } else {
        var address;
        var command;
        if(typeof scene.address === 'string') {
            // Simple scene with a single address for all commands
            address = scene.address;
            command = 'DON';
        } else {
            // Complex scene with a custom command (most likely a program)
            address = scene.address.address;
            command = scene.address.cmd;
        }

        var commandCallback = function(err, success){
            if(err) {
                console.log(err);
                callback(sessionAttributes,
                         buildSpeechletResponse(cardTitle, "There was an issue connecting to the home automation controller", repromptText, shouldEndSession));
            } else {
                console.log(success);
                callback(sessionAttributes,
                         buildSpeechletResponse(cardTitle, "Done!", repromptText, shouldEndSession));
            }
        };

        if(scene.type == "program") {
            console.log('isy.sendProgramCommand',address, command);
            isy.sendProgramCommand(address, command, commandCallback);
        } else {
            console.log('isy.sendDeviceCommand',address, command);
            isy.sendDeviceCommand(address, command, commandCallback);
        }
    }
}

if (process.env.NODE_ENV === 'test') {
    module.exports._private = {
        isy: isy,
        config: config
    };
}