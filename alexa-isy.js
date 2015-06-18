require('dotenv').load();
var isy = require("isy99")({host:process.env.ISY_HOST,
                          port:process.env.ISY_PORT,
                          user:process.env.ISY_USER,
                          pass:process.env.ISY_PASS,
                          https:process.env.ISY_HTTPS
                        });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Allow untrusted self-signed certificates

var devices = [
    {name: 'lights', address:'1815'},
    {name: 'living room lights', address:'1815'},
    {name: 'track lights', address:'1815'},
    {name: 'front lights', address:'1B B 47 1'},
    {name: 'front track lights', address:'1B B 47 1'},
    {name: 'rear lights', address:'1C AB 43 1'},
    {name: 'rear track lights', address:'1C AB 43 1'},
    {name: 'kithen lights', address:'1E 67 D9 1'},
    {name: 'TV', address:{on:'55957', off:'46872'}},
    {name: 'T.V.', address:{on:'55957', off:'46872'}},
    {name: 'Television', address:{on:'55957', off:'46872'}},
    {name: 'bedroom light', address:'1A EA 2A 1'}

];

var actions = [
    {name: 'on', meaning: 'on', command:'DON'},
    {name: 'turn on', meaning: 'on', command:'DON'},
    {name: 'turn up', meaning: 'on', command:'DON'},
    {name: 'bring up', meaning: 'on', command:'DON'},
    {name: 'off', meaning: 'off', command:'DOF'},
    {name: 'turn off', meaning: 'off', command:'DOF'},
    {name: 'turn down', meaning: 'off', command:'DOF'},
    {name: 'bring down', meaning: 'off', command:'DOF'},
    {name: 'kill', meaning: 'off', command:'DFOF'}
];

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);
        console.log("event.session.user.userId=" + event.session.user.userId);
        
        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.98a84475-c47a-4182-bd67-7b78e2eb5e07") {
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
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
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
    var cardTitle = "Welcome";

    var repromptText = "Unused reprompt text";
    var shouldEndSession = true;

    isy.getDeviceInfo("1C AB 43 1", function(err, device){
        console.log(device);

        var speechOutput = "The living room light's address is " + device.address;

        callback(sessionAttributes,
                 buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    });
}

function intentAdjustDevice(intent, session, callback) {
    var didYouMean = require("didyoumean");
    didYouMean.returnWinningObject = true;

    var sessionAttributes = {};
    var cardTitle = "Adjust House Device";
    var repromptText = "";
    var shouldEndSession = true;

    console.log(intent.slots.Device);

    var spokenDevice = intent.slots.Device.value;
    var device = didYouMean(spokenDevice, devices, 'name');

    if (device === null) {
        callback(sessionAttributes,
                 buildSpeechletResponse(cardTitle, "Sorry, I am not sure which device that is", repromptText, shouldEndSession));
    } else {
        var action = didYouMean(intent.slots.Action.value, actions, 'name');
        if (action === null) {
            callback(sessionAttributes,
                     buildSpeechletResponse(cardTitle, "Sorry, I do not understand what Action that is", repromptText, shouldEndSession));
        } else {
            var address;
            var command;
            if(typeof device.address === 'string') {
                address = device.address;
                command = action.command;
            } else {
                address = device.address[action.meaning];
                command = 'DON';
            }

            console.log('isy.sendDeviceCommand',address, command);
            isy.sendDeviceCommand(address, command, function(err, statusCode){
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
            });
        }

    }
}

