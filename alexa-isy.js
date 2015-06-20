require('dotenv').load();
var config = require('./houseconfig.js');
var isy = require("isy99")({host:process.env.ISY_HOST,
                          port:process.env.ISY_PORT,
                          user:process.env.ISY_USER,
                          pass:process.env.ISY_PASS,
                          https:process.env.ISY_HTTPS
                        });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Allow untrusted self-signed certificates

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);
        console.log("event.session.user.userId=" + event.session.user.userId);
        
        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app." + process.env.ALEXA_APP_ID) {
            context.fail("Invalid Application ID");
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
        }
    } catch (e) {
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

    var sessionAttributes = {};
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

